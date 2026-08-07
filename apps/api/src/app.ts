import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { z, ZodError } from 'zod';
import { createAuth } from './auth.js';
import type { AppConfig } from './config.js';
import { createDatabase, type Database } from './db.js';
import { runMigrations } from './migrations.js';
import {
  createOpaqueToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from './security.js';

class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const credentialsSchema = z.object({
  email: z.string().email().max(320).transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(200),
  deviceName: z.string().trim().max(120).optional(),
});

const registerSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(1).max(100),
  timezone: z.string().trim().min(1).max(100).default('UTC'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(32),
  deviceName: z.string().trim().max(120).optional(),
});

const profileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100).optional(),
    avatarUrl: z.string().url().max(2_000).nullable().optional(),
    timezone: z.string().trim().min(1).max(100).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

const inviteSchema = z.object({
  invitedEmail: z
    .string()
    .email()
    .max(320)
    .transform((value) => value.toLowerCase())
    .optional(),
});

const acceptInviteSchema = z.object({
  token: z.string().min(32),
});

const setActiveHouseholdSchema = z.object({
  householdId: z.string().uuid(),
});

type JsonValue =
  | null
  | string
  | number
  | boolean
  | JsonValue[]
  | { [key: string]: JsonValue };

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.string(),
    z.number(),
    z.boolean(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const itemKind = z.enum([
  'VISION',
  'PILLAR',
  'GOAL',
  'PROJECT',
  'ACTION',
  'IDEA',
  'DECISION',
]);

const createItemSchema = z.object({
  kind: itemKind,
  title: z.string().trim().min(1).max(240),
  status: z.string().trim().min(1).max(50).default('ACTIVE'),
  visibility: z.enum(['PRIVATE', 'SHARED']).default('PRIVATE'),
  parentId: z.string().uuid().nullable().optional(),
  body: z.record(z.string(), jsonValueSchema).default({}),
  sortOrder: z.number().int().default(0),
});

const updateItemSchema = z
  .object({
    title: z.string().trim().min(1).max(240).optional(),
    status: z.string().trim().min(1).max(50).optional(),
    visibility: z.enum(['PRIVATE', 'SHARED']).optional(),
    parentId: z.string().uuid().nullable().optional(),
    body: z.record(z.string(), jsonValueSchema).optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

type UserRow = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  avatarUrl: string | null;
  timezone: string;
  activeHouseholdId: string | null;
  createdAt: Date;
};

type HouseholdMembershipRow = {
  householdId: string;
  householdName: string;
  role: 'OWNER' | 'PARTNER';
  joinedAt: Date;
};

type AppDependencies = {
  sql?: Database;
  logger?: boolean;
  runSchemaMigrations?: boolean;
};

function publicUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    timezone: user.timezone,
    activeHouseholdId: user.activeHouseholdId,
    createdAt: user.createdAt,
  };
}

async function getUser(sql: Database, userId: string): Promise<UserRow> {
  const [user] = await sql<UserRow[]>`
    SELECT
      id, email, password_hash, display_name, avatar_url, timezone,
      active_household_id, created_at
    FROM users
    WHERE id = ${userId}
  `;
  if (!user) throw new ApiError(404, 'user_not_found', 'The user no longer exists.');
  return user;
}

async function getMemberships(
  sql: Database,
  userId: string,
): Promise<HouseholdMembershipRow[]> {
  return sql<HouseholdMembershipRow[]>`
    SELECT
      hm.household_id,
      h.name AS household_name,
      hm.role,
      hm.joined_at
    FROM household_members hm
    JOIN households h ON h.id = hm.household_id
    WHERE hm.user_id = ${userId}
    ORDER BY hm.joined_at ASC
  `;
}

async function getAccountPayload(sql: Database, userId: string) {
  const user = await getUser(sql, userId);
  const memberships = await getMemberships(sql, userId);
  const activeHouseholdId =
    user.activeHouseholdId ?? memberships[0]?.householdId ?? null;

  const members = activeHouseholdId
    ? await sql<
        {
          id: string;
          email: string;
          displayName: string;
          avatarUrl: string | null;
          role: 'OWNER' | 'PARTNER';
          joinedAt: Date;
        }[]
      >`
        SELECT
          u.id, u.email, u.display_name, u.avatar_url, hm.role, hm.joined_at
        FROM household_members hm
        JOIN users u ON u.id = hm.user_id
        WHERE hm.household_id = ${activeHouseholdId}
        ORDER BY hm.joined_at ASC
      `
    : [];

  return {
    user: publicUser(user),
    activeHouseholdId,
    households: memberships.map((membership) => ({
      id: membership.householdId,
      name: membership.householdName,
      role: membership.role,
      joinedAt: membership.joinedAt,
      active: membership.householdId === activeHouseholdId,
    })),
    members,
  };
}

export async function buildApp(
  config: AppConfig,
  dependencies: AppDependencies = {},
): Promise<FastifyInstance> {
  const sql = dependencies.sql ?? createDatabase(config.databaseUrl);
  const ownsDatabase = !dependencies.sql;
  if (dependencies.runSchemaMigrations ?? config.autoMigrate) {
    await runMigrations(sql);
  }

  const app = Fastify({
    logger: dependencies.logger ?? config.nodeEnv !== 'test',
    trustProxy: true,
    bodyLimit: 1_000_000,
  });
  const auth = createAuth(config, sql);

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin(origin, callback) {
      if (!origin || config.appOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed'), false);
    },
    credentials: true,
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({
        error: error.code,
        message: error.message,
      });
    }
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'validation_error',
        message: 'The request is invalid.',
        issues: error.issues,
      });
    }
    if ((error as { code?: string }).code === '23505') {
      return reply.code(409).send({
        error: 'conflict',
        message: 'A record with those details already exists.',
      });
    }
    app.log.error(error);
    return reply.code(500).send({
      error: 'internal_error',
      message: 'An unexpected error occurred.',
    });
  });

  app.get('/health', async () => {
    const [result] = await sql<{ now: Date }[]>`SELECT now()`;
    return { status: 'ok', database: Boolean(result), timestamp: result?.now };
  });

  app.post(
    '/v1/auth/register',
    { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = registerSchema.parse(request.body);
      const passwordHash = await hashPassword(body.password);

      const user = await sql.begin(async (transaction) => {
        const [createdUser] = await transaction<UserRow[]>`
          INSERT INTO users (
            email, password_hash, display_name, timezone
          ) VALUES (
            ${body.email}, ${passwordHash}, ${body.displayName}, ${body.timezone}
          )
          RETURNING
            id, email, password_hash, display_name, avatar_url, timezone,
            active_household_id, created_at
        `;
        if (!createdUser) throw new Error('Failed to create user.');

        const [household] = await transaction<{ id: string }[]>`
          INSERT INTO households (name, created_by)
          VALUES (${`${body.displayName}'s Life OS`}, ${createdUser.id})
          RETURNING id
        `;
        if (!household) throw new Error('Failed to create household.');

        await transaction`
          INSERT INTO household_members (household_id, user_id, role)
          VALUES (${household.id}, ${createdUser.id}, 'OWNER')
        `;
        await transaction`
          UPDATE users
          SET active_household_id = ${household.id}, updated_at = now()
          WHERE id = ${createdUser.id}
        `;

        return { ...createdUser, activeHouseholdId: household.id };
      });

      const session = await auth.issueSession(
        { id: user.id, email: user.email },
        body.deviceName,
      );
      return reply.code(201).send({ ...session, account: await getAccountPayload(sql, user.id) });
    },
  );

  app.post(
    '/v1/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request) => {
      const body = credentialsSchema.parse(request.body);
      const [user] = await sql<UserRow[]>`
        SELECT
          id, email, password_hash, display_name, avatar_url, timezone,
          active_household_id, created_at
        FROM users
        WHERE email = ${body.email}
      `;

      if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
        throw new ApiError(401, 'invalid_credentials', 'Email or password is incorrect.');
      }

      const session = await auth.issueSession(
        { id: user.id, email: user.email },
        body.deviceName,
      );
      return { ...session, account: await getAccountPayload(sql, user.id) };
    },
  );

  app.post('/v1/auth/refresh', async (request) => {
    const body = refreshSchema.parse(request.body);
    const tokenHash = hashToken(body.refreshToken);
    const [token] = await sql<{ id: string; userId: string; email: string }[]>`
      SELECT rt.id, rt.user_id, u.email
      FROM refresh_tokens rt
      JOIN users u ON u.id = rt.user_id
      WHERE
        rt.token_hash = ${tokenHash}
        AND rt.revoked_at IS NULL
        AND rt.expires_at > now()
    `;
    if (!token) {
      throw new ApiError(401, 'invalid_refresh_token', 'The session has expired.');
    }

    await sql`
      UPDATE refresh_tokens SET revoked_at = now() WHERE id = ${token.id}
    `;
    return auth.issueSession(
      { id: token.userId, email: token.email },
      body.deviceName,
    );
  });

  app.post('/v1/auth/logout', async (request, reply) => {
    const body = refreshSchema.pick({ refreshToken: true }).parse(request.body);
    await sql`
      UPDATE refresh_tokens
      SET revoked_at = COALESCE(revoked_at, now())
      WHERE token_hash = ${hashToken(body.refreshToken)}
    `;
    return reply.code(204).send();
  });

  app.get('/v1/me', { preHandler: auth.authenticate }, async (request) => {
    return getAccountPayload(sql, request.authUser.id);
  });

  app.patch('/v1/me', { preHandler: auth.authenticate }, async (request) => {
    const body = profileSchema.parse(request.body);
    const avatarProvided = body.avatarUrl !== undefined;
    await sql`
      UPDATE users SET
        display_name = COALESCE(${body.displayName ?? null}, display_name),
        timezone = COALESCE(${body.timezone ?? null}, timezone),
        avatar_url = CASE
          WHEN ${avatarProvided} THEN ${body.avatarUrl ?? null}
          ELSE avatar_url
        END,
        updated_at = now()
      WHERE id = ${request.authUser.id}
    `;
    return getAccountPayload(sql, request.authUser.id);
  });

  app.get('/v1/households', { preHandler: auth.authenticate }, async (request) => {
    return getAccountPayload(sql, request.authUser.id);
  });

  app.patch(
    '/v1/households/active',
    { preHandler: auth.authenticate },
    async (request) => {
      const body = setActiveHouseholdSchema.parse(request.body);
      const [membership] = await sql<{ householdId: string }[]>`
        SELECT household_id
        FROM household_members
        WHERE household_id = ${body.householdId} AND user_id = ${request.authUser.id}
      `;
      if (!membership) {
        throw new ApiError(403, 'not_a_member', 'You are not a member of that household.');
      }
      await sql`
        UPDATE users
        SET active_household_id = ${body.householdId}, updated_at = now()
        WHERE id = ${request.authUser.id}
      `;
      return getAccountPayload(sql, request.authUser.id);
    },
  );

  app.post(
    '/v1/households/invites',
    {
      preHandler: auth.authenticate,
      config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
    },
    async (request, reply) => {
      const body = inviteSchema.parse(request.body);
      const user = await getUser(sql, request.authUser.id);
      if (!user.activeHouseholdId) {
        throw new ApiError(400, 'no_active_household', 'Choose a household first.');
      }

      const [membership] = await sql<{ role: 'OWNER' | 'PARTNER' }[]>`
        SELECT role FROM household_members
        WHERE household_id = ${user.activeHouseholdId}
          AND user_id = ${request.authUser.id}
      `;
      if (membership?.role !== 'OWNER') {
        throw new ApiError(403, 'owner_required', 'Only the household owner can invite a partner.');
      }

      const countRows = await sql<{ count: number }[]>`
        SELECT count(*)::int AS count
        FROM household_members
        WHERE household_id = ${user.activeHouseholdId}
      `;
      const count = countRows[0]?.count ?? 0;
      if (count >= 2) {
        throw new ApiError(409, 'household_full', 'This couple household already has two members.');
      }

      const token = createOpaqueToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await sql`
        INSERT INTO household_invites (
          household_id, created_by, invited_email, token_hash, expires_at
        ) VALUES (
          ${user.activeHouseholdId},
          ${request.authUser.id},
          ${body.invitedEmail ?? null},
          ${hashToken(token)},
          ${expiresAt}
        )
      `;

      return reply.code(201).send({
        token,
        invitedEmail: body.invitedEmail ?? null,
        expiresAt,
        webUrl: `${config.publicAppUrl}/join/${token}`,
        deepLink: `lifeos://join?token=${encodeURIComponent(token)}`,
      });
    },
  );

  app.post(
    '/v1/households/invites/accept',
    { preHandler: auth.authenticate },
    async (request) => {
      const body = acceptInviteSchema.parse(request.body);
      const tokenHash = hashToken(body.token);

      await sql.begin(async (transaction) => {
        const [invite] = await transaction<{
          id: string;
          householdId: string;
          invitedEmail: string | null;
        }[]>`
          SELECT id, household_id, invited_email
          FROM household_invites
          WHERE
            token_hash = ${tokenHash}
            AND accepted_at IS NULL
            AND revoked_at IS NULL
            AND expires_at > now()
          FOR UPDATE
        `;
        if (!invite) {
          throw new ApiError(404, 'invite_invalid', 'The invitation is invalid or expired.');
        }
        if (invite.invitedEmail && invite.invitedEmail !== request.authUser.email) {
          throw new ApiError(
            403,
            'invite_email_mismatch',
            'This invitation was sent to another email address.',
          );
        }

        const [existing] = await transaction<{ userId: string }[]>`
          SELECT user_id
          FROM household_members
          WHERE household_id = ${invite.householdId}
            AND user_id = ${request.authUser.id}
        `;
        const countRows = await transaction<{ count: number }[]>`
          SELECT count(*)::int AS count
          FROM household_members
          WHERE household_id = ${invite.householdId}
        `;
        const count = countRows[0]?.count ?? 0;
        if (!existing && count >= 2) {
          throw new ApiError(409, 'household_full', 'This couple household is already full.');
        }

        await transaction`
          INSERT INTO household_members (household_id, user_id, role)
          VALUES (${invite.householdId}, ${request.authUser.id}, 'PARTNER')
          ON CONFLICT (household_id, user_id) DO NOTHING
        `;
        await transaction`
          UPDATE users
          SET active_household_id = ${invite.householdId}, updated_at = now()
          WHERE id = ${request.authUser.id}
        `;
        await transaction`
          UPDATE household_invites
          SET accepted_by = ${request.authUser.id}, accepted_at = now()
          WHERE id = ${invite.id}
        `;
      });

      return getAccountPayload(sql, request.authUser.id);
    },
  );

  app.delete(
    '/v1/households/members/:userId',
    { preHandler: auth.authenticate },
    async (request, reply) => {
      const { userId } = z.object({ userId: z.string().uuid() }).parse(request.params);
      const current = await getUser(sql, request.authUser.id);
      if (!current.activeHouseholdId) {
        throw new ApiError(400, 'no_active_household', 'Choose a household first.');
      }

      const [actor] = await sql<{ role: 'OWNER' | 'PARTNER' }[]>`
        SELECT role FROM household_members
        WHERE household_id = ${current.activeHouseholdId}
          AND user_id = ${request.authUser.id}
      `;
      const removingSelf = userId === request.authUser.id;
      if (!actor || (!removingSelf && actor.role !== 'OWNER')) {
        throw new ApiError(403, 'forbidden', 'You cannot remove that household member.');
      }
      if (removingSelf && actor.role === 'OWNER') {
        throw new ApiError(
          409,
          'owner_cannot_leave',
          'The owner must remove their partner rather than leave the household.',
        );
      }

      await sql.begin(async (transaction) => {
        await transaction`
          DELETE FROM household_members
          WHERE household_id = ${current.activeHouseholdId} AND user_id = ${userId}
        `;
        const [fallback] = await transaction<{ householdId: string }[]>`
          SELECT household_id
          FROM household_members
          WHERE user_id = ${userId}
          ORDER BY joined_at ASC
          LIMIT 1
        `;
        await transaction`
          UPDATE users
          SET active_household_id = ${fallback?.householdId ?? null}, updated_at = now()
          WHERE id = ${userId}
        `;
      });

      return reply.code(204).send();
    },
  );

  app.get('/v1/items', { preHandler: auth.authenticate }, async (request) => {
    const query = z.object({ kind: itemKind.optional() }).parse(request.query);
    const kindFilter = query.kind ? sql`AND li.kind = ${query.kind}` : sql``;

    return sql`
      SELECT li.*
      FROM life_items li
      WHERE (
        li.owner_user_id = ${request.authUser.id}
        OR (
          li.visibility = 'SHARED'
          AND EXISTS (
            SELECT 1 FROM household_members hm
            WHERE hm.household_id = li.household_id
              AND hm.user_id = ${request.authUser.id}
          )
        )
      )
      ${kindFilter}
      ORDER BY li.sort_order ASC, li.updated_at DESC
    `;
  });

  app.post('/v1/items', { preHandler: auth.authenticate }, async (request, reply) => {
    const body = createItemSchema.parse(request.body);
    const user = await getUser(sql, request.authUser.id);
    const householdId = body.visibility === 'SHARED' ? user.activeHouseholdId : null;
    if (body.visibility === 'SHARED' && !householdId) {
      throw new ApiError(400, 'no_active_household', 'Choose a household before sharing.');
    }

    const [item] = await sql`
      INSERT INTO life_items (
        owner_user_id, household_id, parent_id, kind, visibility,
        title, status, body, sort_order
      ) VALUES (
        ${request.authUser.id},
        ${householdId},
        ${body.parentId ?? null},
        ${body.kind},
        ${body.visibility},
        ${body.title},
        ${body.status},
        ${sql.json(body.body)},
        ${body.sortOrder}
      )
      RETURNING *
    `;
    return reply.code(201).send(item);
  });

  app.patch('/v1/items/:id', { preHandler: auth.authenticate }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = updateItemSchema.parse(request.body);
    const user = await getUser(sql, request.authUser.id);
    const [existing] = await sql<{ id: string; visibility: 'PRIVATE' | 'SHARED' }[]>`
      SELECT id, visibility FROM life_items
      WHERE id = ${id} AND owner_user_id = ${request.authUser.id}
    `;
    if (!existing) {
      throw new ApiError(404, 'item_not_found', 'The item does not exist or is not yours.');
    }

    const nextVisibility = body.visibility ?? existing.visibility;
    const householdId = nextVisibility === 'SHARED' ? user.activeHouseholdId : null;
    if (nextVisibility === 'SHARED' && !householdId) {
      throw new ApiError(400, 'no_active_household', 'Choose a household before sharing.');
    }
    const bodyProvided = body.body !== undefined;
    const parentProvided = body.parentId !== undefined;

    const [updated] = await sql`
      UPDATE life_items SET
        title = COALESCE(${body.title ?? null}, title),
        status = COALESCE(${body.status ?? null}, status),
        visibility = ${nextVisibility},
        household_id = ${householdId},
        parent_id = CASE
          WHEN ${parentProvided} THEN ${body.parentId ?? null}
          ELSE parent_id
        END,
        body = CASE
          WHEN ${bodyProvided} THEN ${sql.json(body.body ?? {})}
          ELSE body
        END,
        sort_order = COALESCE(${body.sortOrder ?? null}, sort_order),
        updated_at = now()
      WHERE id = ${id} AND owner_user_id = ${request.authUser.id}
      RETURNING *
    `;
    return updated;
  });

  app.delete('/v1/items/:id', { preHandler: auth.authenticate }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const result = await sql`
      DELETE FROM life_items
      WHERE id = ${id} AND owner_user_id = ${request.authUser.id}
      RETURNING id
    `;
    if (result.count === 0) {
      throw new ApiError(404, 'item_not_found', 'The item does not exist or is not yours.');
    }
    return reply.code(204).send();
  });

  app.addHook('onClose', async () => {
    if (ownsDatabase) await sql.end();
  });

  return app;
}
