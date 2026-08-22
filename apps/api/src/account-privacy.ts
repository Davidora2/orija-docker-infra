import { randomInt } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthService } from './auth.js';
import type { AppConfig } from './config.js';
import type { Database } from './db.js';
import { ApiError } from './errors.js';
import type { Mailer } from './mailer.js';
import { hashToken, verifyPassword } from './security.js';

const preferencesSchema = z.object({
  emailRemindersEnabled: z.boolean(),
});

const deleteSchema = z.object({
  confirmation: z.string().max(400),
  currentPassword: z.string().max(200).optional(),
  verificationCode: z.string().regex(/^\d{6}$/).optional(),
});

type PrivacyUser = {
  id: string;
  email: string;
  passwordHash: string | null;
  displayName: string;
  avatarUrl: string | null;
  timezone: string;
  preferredCurrency: string;
  activeHouseholdId: string | null;
  onboardingCompletedAt: Date | null;
  emailRemindersEnabled: boolean;
  createdAt: Date;
};

async function privacyUser(sql: Database, userId: string): Promise<PrivacyUser> {
  const [user] = await sql<PrivacyUser[]>`
    SELECT
      id,
      email,
      password_hash,
      display_name,
      avatar_url,
      timezone,
      preferred_currency,
      active_household_id,
      onboarding_completed_at,
      email_reminders_enabled,
      created_at
    FROM users
    WHERE id = ${userId}
  `;
  if (!user) throw new ApiError(404, 'user_not_found', 'The user no longer exists.');
  return user;
}

async function verifyDeletionReauthentication(
  sql: Database,
  user: PrivacyUser,
  input: z.infer<typeof deleteSchema>,
): Promise<void> {
  if (user.passwordHash) {
    if (
      !input.currentPassword ||
      !(await verifyPassword(input.currentPassword, user.passwordHash))
    ) {
      throw new ApiError(
        401,
        'reauthentication_failed',
        'Enter your current password to delete your account.',
      );
    }
    return;
  }

  if (!input.verificationCode) {
    throw new ApiError(
      401,
      'reauthentication_required',
      'Request and enter the account deletion code sent to your verified email.',
    );
  }
  const codeHash = hashToken(input.verificationCode);
  const [code] = await sql<{ id: string }[]>`
    SELECT id
    FROM auth_codes
    WHERE user_id = ${user.id}
      AND email = ${user.email}
      AND purpose = 'account_deletion'
      AND code_hash = ${codeHash}
      AND consumed_at IS NULL
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (!code) {
    throw new ApiError(
      401,
      'reauthentication_failed',
      'The account deletion code is invalid or expired.',
    );
  }
  await sql`UPDATE auth_codes SET consumed_at = now() WHERE id = ${code.id}`;
}

async function buildDataExport(sql: Database, user: PrivacyUser) {
  const households = await sql`
    SELECT h.id, h.name, hm.role, hm.joined_at
    FROM household_members hm
    JOIN households h ON h.id = hm.household_id
    WHERE hm.user_id = ${user.id}
    ORDER BY hm.joined_at
  `;
  const lifeItems = await sql`
    SELECT
      id, household_id, parent_id, kind, visibility, title, status, body,
      sort_order, created_at, updated_at
    FROM life_items
    WHERE owner_user_id = ${user.id}
    ORDER BY created_at
  `;
  const weeklyReviews = await sql`
    SELECT
      id, schema_version, household_id, week_start, results, capacity,
      bottlenecks, start_doing, stop_doing, continue_doing,
      next_week_priorities, created_at, updated_at
    FROM weekly_reviews
    WHERE user_id = ${user.id}
    ORDER BY week_start DESC
  `;
  const budgets = await sql`
    SELECT *
    FROM budgets
    WHERE owner_user_id = ${user.id}
    ORDER BY created_at
  `;
  const budgetCategories = await sql`
    SELECT bc.*
    FROM budget_categories bc
    JOIN budgets b ON b.id = bc.budget_id
    WHERE b.owner_user_id = ${user.id}
    ORDER BY bc.created_at
  `;
  const budgetEntries = await sql`
    SELECT be.*
    FROM budget_entries be
    JOIN budgets b ON b.id = be.budget_id
    WHERE b.owner_user_id = ${user.id}
    ORDER BY be.occurred_on, be.created_at
  `;
  const recurringOutgoings = await sql`
    SELECT bro.*
    FROM budget_recurring_outgoings bro
    JOIN budgets b ON b.id = bro.budget_id
    WHERE b.owner_user_id = ${user.id}
    ORDER BY bro.created_at
  `;
  const budgetDraftExpenses = await sql`
    SELECT bde.*
    FROM budget_draft_expenses bde
    JOIN budgets b ON b.id = bde.budget_id
    WHERE b.owner_user_id = ${user.id}
    ORDER BY bde.created_at
  `;
  const savingGoals = await sql`
    SELECT *
    FROM saving_goals
    WHERE owner_user_id = ${user.id}
    ORDER BY created_at
  `;
  const investmentAccounts = await sql`
    SELECT *
    FROM investment_accounts
    WHERE owner_user_id = ${user.id}
    ORDER BY created_at
  `;
  const wealthGapIdeas = await sql`
    SELECT *
    FROM wealth_gap_ideas
    WHERE owner_user_id = ${user.id}
    ORDER BY created_at
  `;
  const debts = await sql`
    SELECT *
    FROM debts
    WHERE owner_user_id = ${user.id}
    ORDER BY created_at
  `;
  const payments = await sql`
    SELECT *
    FROM payment_occurrences
    WHERE owner_user_id = ${user.id}
    ORDER BY due_date, paid_at
  `;
  const calendarConnections = await sql`
    SELECT
      id, provider, account_email, calendar_id, sync_tasks, sync_payments,
      sync_paydays, reminder_minutes, last_synced_at, created_at, updated_at
    FROM calendar_connections
    WHERE user_id = ${user.id}
    ORDER BY created_at
  `;

  return {
    exportVersion: 1,
    generatedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      timezone: user.timezone,
      preferredCurrency: user.preferredCurrency,
      activeHouseholdId: user.activeHouseholdId,
      onboardingCompletedAt: user.onboardingCompletedAt,
      emailRemindersEnabled: user.emailRemindersEnabled,
      createdAt: user.createdAt,
    },
    households,
    lifeItems,
    weeklyReviews,
    money: {
      budgets,
      budgetCategories,
      budgetEntries,
      recurringOutgoings,
      budgetDraftExpenses,
      savingGoals,
      investmentAccounts,
      wealthGapIdeas,
      debts,
      payments,
    },
    integrations: {
      calendarConnections,
      note: 'OAuth access tokens, refresh tokens, login identifiers, and session tokens are excluded.',
    },
  };
}

export function registerAccountPrivacyRoutes(
  app: FastifyInstance,
  sql: Database,
  config: AppConfig,
  auth: AuthService,
  mailer: Mailer,
): void {
  app.get(
    '/v1/me/preferences',
    { preHandler: auth.authenticate },
    async (request) => {
      const user = await privacyUser(sql, request.authUser.id);
      return {
        emailRemindersEnabled: user.emailRemindersEnabled,
        deliveryChannels: ['email'],
      };
    },
  );

  app.patch(
    '/v1/me/preferences',
    { preHandler: auth.authenticate },
    async (request) => {
      const body = preferencesSchema.parse(request.body);
      await sql`
        UPDATE users
        SET email_reminders_enabled = ${body.emailRemindersEnabled}, updated_at = now()
        WHERE id = ${request.authUser.id}
      `;
      return {
        emailRemindersEnabled: body.emailRemindersEnabled,
        deliveryChannels: ['email'],
      };
    },
  );

  app.get(
    '/v1/me/export',
    { preHandler: auth.authenticate },
    async (request, reply) => {
      const user = await privacyUser(sql, request.authUser.id);
      reply.header('content-disposition', 'attachment; filename="life-os-export.json"');
      reply.header('cache-control', 'no-store');
      return buildDataExport(sql, user);
    },
  );

  app.post(
    '/v1/me/deletion-code',
    {
      preHandler: auth.authenticate,
      config: { rateLimit: { max: 4, timeWindow: '15 minutes' } },
    },
    async (request) => {
      const user = await privacyUser(sql, request.authUser.id);
      if (user.passwordHash) {
        throw new ApiError(
          400,
          'password_reauthentication_required',
          'Password accounts must re-enter the current password.',
        );
      }
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      await sql`
        UPDATE auth_codes
        SET consumed_at = COALESCE(consumed_at, now())
        WHERE user_id = ${user.id}
          AND purpose = 'account_deletion'
          AND consumed_at IS NULL
      `;
      await sql`
        INSERT INTO auth_codes (
          email, user_id, purpose, code_hash, expires_at
        ) VALUES (
          ${user.email},
          ${user.id},
          'account_deletion',
          ${hashToken(code)},
          ${new Date(Date.now() + 15 * 60 * 1000)}
        )
      `;
      await mailer.send({
        to: user.email,
        subject: 'Confirm deletion of your Life OS account',
        text: `Your Life OS account deletion code is ${code}. It expires in 15 minutes.\n\nIf you did not request this, keep your account and ignore this email.`,
        purpose: 'auth',
      });
      return {
        ok: true,
        message: 'A deletion confirmation code was sent to your verified email.',
        ...(config.authDebugCodes ? { debugCode: code } : {}),
      };
    },
  );

  app.delete(
    '/v1/me',
    {
      preHandler: auth.authenticate,
      config: { rateLimit: { max: 4, timeWindow: '1 hour' } },
    },
    async (request, reply) => {
      const body = deleteSchema.parse(request.body);
      const user = await privacyUser(sql, request.authUser.id);
      if (body.confirmation !== `DELETE ${user.email}`) {
        throw new ApiError(
          400,
          'delete_confirmation_mismatch',
          `Type DELETE ${user.email} exactly to confirm.`,
        );
      }
      await verifyDeletionReauthentication(sql, user, body);

      await sql.begin(async (transaction) => {
        const ownedHouseholds = await transaction<{ id: string }[]>`
          SELECT id
          FROM households
          WHERE created_by = ${user.id}
          FOR UPDATE
        `;
        const householdIds = await transaction<{ householdId: string }[]>`
          SELECT household_id
          FROM household_members
          WHERE user_id = ${user.id}
        `;
        const transferred: string[] = [];

        await transaction`
          UPDATE users
          SET active_household_id = NULL
          WHERE id = ${user.id}
        `;

        for (const household of ownedHouseholds) {
          const [successor] = await transaction<{ userId: string }[]>`
            SELECT user_id
            FROM household_members
            WHERE household_id = ${household.id}
              AND user_id <> ${user.id}
            ORDER BY joined_at
            LIMIT 1
          `;
          if (successor) {
            await transaction`
              DELETE FROM household_members
              WHERE household_id = ${household.id}
                AND user_id = ${user.id}
            `;
            await transaction`
              UPDATE household_members
              SET role = 'OWNER'
              WHERE household_id = ${household.id}
                AND user_id = ${successor.userId}
            `;
            await transaction`
              UPDATE households
              SET created_by = ${successor.userId}, updated_at = now()
              WHERE id = ${household.id}
            `;
            transferred.push(household.id);
          } else {
            await transaction`DELETE FROM households WHERE id = ${household.id}`;
          }
        }

        await transaction`
          INSERT INTO account_deletion_audit (
            deleted_user_id,
            email_sha256,
            household_ids,
            transferred_household_ids
          ) VALUES (
            ${user.id},
            encode(digest(${user.email}, 'sha256'), 'hex'),
            ${householdIds.map((row) => row.householdId)}::uuid[],
            ${transferred}::uuid[]
          )
        `;
        await transaction`DELETE FROM users WHERE id = ${user.id}`;
      });

      return reply.code(204).send();
    },
  );
}
