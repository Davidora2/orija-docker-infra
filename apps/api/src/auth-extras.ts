import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { AuthService } from './auth.js';
import type { AppConfig } from './config.js';
import type { Database } from './db.js';
import { ApiError } from './errors.js';
import { verifyGoogleIdToken } from './google-auth.js';
import { verifyMicrosoftIdToken } from './microsoft-auth.js';
import { createMailer, generateNumericCode } from './mailer.js';
import { hashPassword, hashToken } from './security.js';

type UserRow = {
  id: string;
  email: string;
  passwordHash: string | null;
  displayName: string;
  avatarUrl: string | null;
  timezone: string;
  preferredCurrency?: string;
  activeHouseholdId: string | null;
  onboardingCompletedAt: Date | null;
  googleSub: string | null;
  microsoftSub?: string | null;
  createdAt: Date;
};

export function registerAuthExtras(
  app: FastifyInstance,
  sql: Database,
  config: AppConfig,
  auth: AuthService,
  helpers: {
    getAccountPayload: (sql: Database, userId: string) => Promise<unknown>;
    publicUser: (user: {
      id: string;
      email: string;
      displayName: string;
      avatarUrl: string | null;
      timezone: string;
      preferredCurrency?: string;
      activeHouseholdId: string | null;
      onboardingCompletedAt: Date | null;
      createdAt: Date;
    }) => unknown;
  },
): void {
  const mailer = createMailer(config);

  async function ensureHousehold(user: UserRow): Promise<UserRow> {
    if (user.activeHouseholdId) return user;
    return sql.begin(async (tx) => {
      const [household] = await tx<{ id: string }[]>`
        INSERT INTO households (name, created_by)
        VALUES (${`${user.displayName}'s Life OS`}, ${user.id})
        RETURNING id
      `;
      if (!household) throw new ApiError(500, 'household_create_failed', 'Could not create household.');
      await tx`
        INSERT INTO household_members (household_id, user_id, role)
        VALUES (${household.id}, ${user.id}, 'OWNER')
      `;
      const [updated] = await tx<UserRow[]>`
        UPDATE users
        SET active_household_id = ${household.id}, updated_at = now()
        WHERE id = ${user.id}
        RETURNING
          id, email, password_hash, display_name, avatar_url, timezone,
          active_household_id, onboarding_completed_at, google_sub, created_at
      `;
      if (!updated) throw new ApiError(500, 'user_update_failed', 'Could not update user.');
      return updated;
    });
  }

  app.get('/v1/auth/providers', async () => {
    return {
      google: config.googleClientIds.length > 0,
      microsoft: Boolean(config.microsoftClientId),
      password: true,
      emailDelivery: config.smtpUser && config.smtpAppPassword
        ? 'smtp'
        : config.resendApiKey
          ? 'resend'
          : config.nodeEnv === 'production'
            ? 'unavailable'
            : 'console',
      calendarSync: {
        google: Boolean(config.googleClientIds[0] && config.googleOauthClientSecret),
        microsoft: Boolean(config.microsoftClientId),
      },
    };
  });

  app.post(
    '/v1/auth/google',
    { config: { rateLimit: { max: config.nodeEnv === 'test' ? 1000 : 20, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = z
        .object({
          idToken: z.string().min(20),
          deviceName: z.string().trim().max(120).optional(),
          timezone: z.string().trim().min(1).max(100).default('UTC'),
        })
        .parse(request.body);

      const identity = await verifyGoogleIdToken(body.idToken, config.googleClientIds);

      let [user] = await sql<UserRow[]>`
        SELECT
          id, email, password_hash, display_name, avatar_url, timezone,
          active_household_id, onboarding_completed_at, google_sub, created_at
        FROM users
        WHERE google_sub = ${identity.sub} OR email = ${identity.email}
        LIMIT 1
      `;

      if (!user) {
        user = await sql.begin(async (tx) => {
          const [created] = await tx<UserRow[]>`
            INSERT INTO users (
              email, password_hash, display_name, avatar_url, timezone,
              google_sub, email_verified_at
            ) VALUES (
              ${identity.email},
              NULL,
              ${identity.name ?? identity.email.split('@')[0] ?? 'Life OS user'},
              ${identity.picture},
              ${body.timezone},
              ${identity.sub},
              ${identity.emailVerified ? new Date() : null}
            )
            RETURNING
              id, email, password_hash, display_name, avatar_url, timezone,
              active_household_id, onboarding_completed_at, google_sub, created_at
          `;
          if (!created) {
            throw new ApiError(500, 'user_create_failed', 'Could not create Google user.');
          }
          const [household] = await tx<{ id: string }[]>`
            INSERT INTO households (name, created_by)
            VALUES (${`${created.displayName}'s Life OS`}, ${created.id})
            RETURNING id
          `;
          if (!household) {
            throw new ApiError(500, 'household_create_failed', 'Could not create household.');
          }
          await tx`
            INSERT INTO household_members (household_id, user_id, role)
            VALUES (${household.id}, ${created.id}, 'OWNER')
          `;
          const [updated] = await tx<UserRow[]>`
            UPDATE users
            SET active_household_id = ${household.id}, updated_at = now()
            WHERE id = ${created.id}
            RETURNING
              id, email, password_hash, display_name, avatar_url, timezone,
              active_household_id, onboarding_completed_at, google_sub, created_at
          `;
          if (!updated) {
            throw new ApiError(500, 'user_update_failed', 'Could not update Google user.');
          }
          return updated;
        });
      } else {
        await sql`
          UPDATE users SET
            google_sub = COALESCE(google_sub, ${identity.sub}),
            avatar_url = COALESCE(avatar_url, ${identity.picture}),
            email_verified_at = COALESCE(email_verified_at, ${identity.emailVerified ? new Date() : null}),
            updated_at = now()
          WHERE id = ${user.id}
        `;
        user = await ensureHousehold(user);
      }

      const session = await auth.issueSession(
        { id: user.id, email: user.email },
        body.deviceName,
      );
      return reply.code(200).send({
        ...session,
        account: await helpers.getAccountPayload(sql, user.id),
      });
    },
  );

  app.post(
    '/v1/auth/microsoft',
    { config: { rateLimit: { max: config.nodeEnv === 'test' ? 1000 : 20, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = z
        .object({
          idToken: z.string().min(20),
          deviceName: z.string().trim().max(120).optional(),
          timezone: z.string().trim().min(1).max(100).default('UTC'),
        })
        .parse(request.body);

      const identity = await verifyMicrosoftIdToken(
        body.idToken,
        config.microsoftClientId ? [config.microsoftClientId] : [],
        config.microsoftTenantId,
      );

      let [user] = await sql<UserRow[]>`
        SELECT
          id, email, password_hash, display_name, avatar_url, timezone,
          active_household_id, onboarding_completed_at, google_sub, microsoft_sub, created_at
        FROM users
        WHERE microsoft_sub = ${identity.sub} OR email = ${identity.email}
        LIMIT 1
      `;

      if (!user) {
        user = await sql.begin(async (tx) => {
          const [created] = await tx<UserRow[]>`
            INSERT INTO users (
              email, password_hash, display_name, avatar_url, timezone,
              microsoft_sub, email_verified_at
            ) VALUES (
              ${identity.email},
              NULL,
              ${identity.name ?? identity.email.split('@')[0] ?? 'Life OS user'},
              NULL,
              ${body.timezone},
              ${identity.sub},
              ${identity.emailVerified ? new Date() : null}
            )
            RETURNING
              id, email, password_hash, display_name, avatar_url, timezone,
              active_household_id, onboarding_completed_at, google_sub, microsoft_sub, created_at
          `;
          if (!created) {
            throw new ApiError(500, 'user_create_failed', 'Could not create Microsoft user.');
          }
          const [household] = await tx<{ id: string }[]>`
            INSERT INTO households (name, created_by)
            VALUES (${`${created.displayName}'s Life OS`}, ${created.id})
            RETURNING id
          `;
          if (!household) {
            throw new ApiError(500, 'household_create_failed', 'Could not create household.');
          }
          await tx`
            INSERT INTO household_members (household_id, user_id, role)
            VALUES (${household.id}, ${created.id}, 'OWNER')
          `;
          const [updated] = await tx<UserRow[]>`
            UPDATE users
            SET active_household_id = ${household.id}, updated_at = now()
            WHERE id = ${created.id}
            RETURNING
              id, email, password_hash, display_name, avatar_url, timezone,
              active_household_id, onboarding_completed_at, google_sub, microsoft_sub, created_at
          `;
          if (!updated) {
            throw new ApiError(500, 'user_update_failed', 'Could not update Microsoft user.');
          }
          return updated;
        });
      } else {
        await sql`
          UPDATE users SET
            microsoft_sub = COALESCE(microsoft_sub, ${identity.sub}),
            email_verified_at = COALESCE(email_verified_at, ${identity.emailVerified ? new Date() : null}),
            updated_at = now()
          WHERE id = ${user.id}
        `;
        user = await ensureHousehold(user);
      }

      const session = await auth.issueSession(
        { id: user.id, email: user.email },
        body.deviceName,
      );
      return reply.code(200).send({
        ...session,
        account: await helpers.getAccountPayload(sql, user.id),
      });
    },
  );

  app.post(
    '/v1/auth/forgot-password',
    {
      config: {
        rateLimit: { max: config.nodeEnv === 'test' ? 1000 : 5, timeWindow: '10 minutes' },
      },
    },
    async (request, reply) => {
      const body = z
        .object({
          email: z.string().email().max(320).transform((value) => value.toLowerCase()),
        })
        .parse(request.body);

      const [user] = await sql<UserRow[]>`
        SELECT
          id, email, password_hash, display_name, avatar_url, timezone,
          active_household_id, onboarding_completed_at, google_sub, created_at
        FROM users
        WHERE email = ${body.email}
      `;

      // Always look successful to avoid email enumeration
      const generic = {
        ok: true,
        message: 'If that email exists, a verification code is on its way.',
      };

      if (!user) {
        return reply.send(generic);
      }

      const code = generateNumericCode(6);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await sql`
        UPDATE auth_codes
        SET consumed_at = now()
        WHERE email = ${body.email}
          AND purpose = 'password_reset'
          AND consumed_at IS NULL
      `;
      await sql`
        INSERT INTO auth_codes (email, user_id, purpose, code_hash, expires_at)
        VALUES (
          ${body.email},
          ${user.id},
          'password_reset',
          ${hashToken(code)},
          ${expiresAt}
        )
      `;

      const delivery = await mailer.send({
        to: body.email,
        subject: 'Your Life OS password reset code',
        text: `Your Life OS verification code is ${code}. It expires in 15 minutes.\n\nIf you did not request this, you can ignore this email.`,
      });

      return reply.send({
        ...generic,
        delivery: delivery.mode,
        ...(config.authDebugCodes ? { debugCode: code } : {}),
      });
    },
  );

  app.post(
    '/v1/auth/verify-reset-code',
    {
      config: {
        rateLimit: { max: config.nodeEnv === 'test' ? 1000 : 20, timeWindow: '10 minutes' },
      },
    },
    async (request) => {
      const body = z
        .object({
          email: z.string().email().max(320).transform((value) => value.toLowerCase()),
          code: z.string().trim().min(4).max(12),
        })
        .parse(request.body);

      await assertValidResetCode(sql, body.email, body.code);
      return { ok: true, message: 'Code verified. You can set a new password.' };
    },
  );

  app.post(
    '/v1/auth/reset-password',
    {
      config: {
        rateLimit: { max: config.nodeEnv === 'test' ? 1000 : 10, timeWindow: '10 minutes' },
      },
    },
    async (request, reply) => {
      const body = z
        .object({
          email: z.string().email().max(320).transform((value) => value.toLowerCase()),
          code: z.string().trim().min(4).max(12),
          newPassword: z.string().min(10).max(200),
          deviceName: z.string().trim().max(120).optional(),
        })
        .parse(request.body);

      const codeRow = await assertValidResetCode(sql, body.email, body.code);
      const passwordHash = await hashPassword(body.newPassword);

      const [user] = await sql<UserRow[]>`
        UPDATE users
        SET password_hash = ${passwordHash}, updated_at = now()
        WHERE id = ${codeRow.userId}
        RETURNING
          id, email, password_hash, display_name, avatar_url, timezone,
          active_household_id, onboarding_completed_at, google_sub, created_at
      `;
      if (!user) {
        throw new ApiError(404, 'user_not_found', 'Account not found.');
      }

      await sql`
        UPDATE auth_codes
        SET consumed_at = now()
        WHERE id = ${codeRow.id}
      `;
      await sql`
        UPDATE refresh_tokens
        SET revoked_at = now()
        WHERE user_id = ${user.id} AND revoked_at IS NULL
      `;

      const session = await auth.issueSession(
        { id: user.id, email: user.email },
        body.deviceName,
      );
      return reply.send({
        ...session,
        account: await helpers.getAccountPayload(sql, user.id),
      });
    },
  );
}

async function assertValidResetCode(
  sql: Database,
  email: string,
  code: string,
): Promise<{ id: string; userId: string }> {
  const [row] = await sql<{
    id: string;
    userId: string;
    codeHash: string;
    attempts: number;
    expiresAt: Date;
  }[]>`
    SELECT id, user_id, code_hash, attempts, expires_at
    FROM auth_codes
    WHERE email = ${email}
      AND purpose = 'password_reset'
      AND consumed_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (!row || row.expiresAt.getTime() < Date.now()) {
    throw new ApiError(400, 'invalid_code', 'That code is invalid or expired.');
  }
  if (row.attempts >= 8) {
    throw new ApiError(429, 'code_locked', 'Too many attempts. Request a new code.');
  }

  const ok = hashToken(code) === row.codeHash;
  // Also accept verifyPassword-style? No — codes are hashed with hashToken
  if (!ok) {
    await sql`
      UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ${row.id}
    `;
    throw new ApiError(400, 'invalid_code', 'That code is invalid or expired.');
  }

  return { id: row.id, userId: row.userId };
}
