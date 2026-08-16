import { ApiError } from './errors.js';
import type { Database } from './db.js';
import {
  assertRecurringCadence,
  buildRecommendations,
  daysInMonth,
  listRecurring,
  payDatesInMonth,
  projectRecurringForMonth,
  toDateString,
  type OutgoingItem,
  type PayFrequency,
} from './budget-cashflow.js';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';

export const SUGGESTED_LIFE_AREAS = [
  { title: 'Health', icon: 'fitness-outline' },
  { title: 'Career', icon: 'trending-up-outline' },
  { title: 'Wealth', icon: 'wallet-outline' },
  { title: 'Relationships', icon: 'heart-outline' },
  { title: 'Family', icon: 'home-outline' },
  { title: 'Personal growth', icon: 'sparkles-outline' },
  { title: 'Creative', icon: 'color-palette-outline' },
  { title: 'Product', icon: 'layers-outline' },
  { title: 'Business', icon: 'briefcase-outline' },
  { title: 'Faith', icon: 'leaf-outline' },
  { title: 'Community', icon: 'people-outline' },
  { title: 'Adventure', icon: 'airplane-outline' },
] as const;

const DEFAULT_BUDGET_CATEGORIES = [
  'Housing',
  'Food',
  'Transport',
  'Utilities',
  'Health',
  'Fun',
  'Savings',
  'Other',
] as const;

type AuthUser = { id: string };

async function assertBudgetAccess(
  sql: Database,
  userId: string,
  budgetId: string,
  requireOwner = false,
): Promise<{
  id: string;
  ownerUserId: string;
  householdId: string | null;
  visibility: 'PRIVATE' | 'SHARED';
  name: string;
  currency: string;
  period: 'weekly' | 'monthly';
}> {
  const [budget] = await sql<
    {
      id: string;
      ownerUserId: string;
      householdId: string | null;
      visibility: 'PRIVATE' | 'SHARED';
      name: string;
      currency: string;
      period: 'weekly' | 'monthly';
    }[]
  >`
    SELECT
      b.id, b.owner_user_id, b.household_id, b.visibility,
      b.name, b.currency, b.period
    FROM budgets b
    WHERE
      b.id = ${budgetId}
      AND (
        b.owner_user_id = ${userId}
        OR (
          b.visibility = 'SHARED'
          AND EXISTS (
            SELECT 1 FROM household_members hm
            WHERE hm.household_id = b.household_id
              AND hm.user_id = ${userId}
          )
        )
      )
  `;
  if (!budget) {
    throw new ApiError(404, 'budget_not_found', 'Budget not found.');
  }
  if (requireOwner && budget.ownerUserId !== userId) {
    throw new ApiError(403, 'forbidden', 'Only the budget owner can do that.');
  }
  return budget;
}

async function budgetDetail(sql: Database, budgetId: string) {
  const [budget] = await sql`
    SELECT * FROM budgets WHERE id = ${budgetId}
  `;
  if (!budget) {
    throw new ApiError(404, 'budget_not_found', 'Budget not found.');
  }
  const categories = await sql<{ id: string; plannedCents: number }[]>`
    SELECT * FROM budget_categories
    WHERE budget_id = ${budgetId}
    ORDER BY sort_order ASC, created_at ASC
  `;
  const entries = await sql`
    SELECT * FROM budget_entries
    WHERE budget_id = ${budgetId}
    ORDER BY occurred_on DESC, created_at DESC
    LIMIT 100
  `;
  const recurring = await listRecurring(sql, budgetId);
  const [totals] = await sql<
    {
      incomeCents: string | number;
      expenseCents: string | number;
    }[]
  >`
    SELECT
      COALESCE(SUM(CASE WHEN kind = 'INCOME' THEN amount_cents ELSE 0 END), 0) AS income_cents,
      COALESCE(SUM(CASE WHEN kind = 'EXPENSE' THEN amount_cents ELSE 0 END), 0) AS expense_cents
    FROM budget_entries
    WHERE budget_id = ${budgetId}
  `;
  const spentByCategory = await sql<{ categoryId: string; spentCents: string | number }[]>`
    SELECT category_id, COALESCE(SUM(amount_cents), 0) AS spent_cents
    FROM budget_entries
    WHERE budget_id = ${budgetId} AND kind = 'EXPENSE' AND category_id IS NOT NULL
    GROUP BY category_id
  `;
  const spentMap = new Map(
    spentByCategory.map((row) => [row.categoryId, Number(row.spentCents)]),
  );

  return {
    ...budget,
    categories: categories.map((category) => ({
      ...category,
      spentCents: spentMap.get(category.id) ?? 0,
    })),
    entries,
    recurring,
    summary: {
      incomeCents: Number(totals?.incomeCents ?? 0),
      expenseCents: Number(totals?.expenseCents ?? 0),
      plannedCents: categories.reduce(
        (sum, category) => sum + Number(category.plannedCents ?? 0),
        0,
      ),
      balanceCents:
        Number(totals?.incomeCents ?? 0) - Number(totals?.expenseCents ?? 0),
    },
  };
}

export function registerOnboardingAndBudgetRoutes(
  app: FastifyInstance,
  sql: Database,
  auth: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authenticate: any;
  },
  helpers: {
    getUser: (sql: Database, userId: string) => Promise<{
      id: string;
      activeHouseholdId: string | null;
      preferredCurrency?: string;
    }>;
    getAccountPayload: (sql: Database, userId: string) => Promise<unknown>;
  },
): void {
  app.get('/v1/areas/suggestions', { preHandler: auth.authenticate }, async () => {
    return { suggestions: SUGGESTED_LIFE_AREAS };
  });

  app.post(
    '/v1/onboarding/complete',
    { preHandler: auth.authenticate },
    async (request) => {
      const userId = (request as { authUser: AuthUser }).authUser.id;
      const body = z
        .object({
          areas: z
            .array(
              z.object({
                title: z.string().trim().min(1).max(80),
                icon: z.string().trim().max(60).optional(),
              }),
            )
            .min(1)
            .max(20),
          preferredCurrency: z
            .string()
            .trim()
            .toUpperCase()
            .regex(/^[A-Z]{3}$/)
            .optional(),
        })
        .parse(request.body);

      await sql.begin(async (tx) => {
        // Replace existing active pillars with chosen areas
        await tx`
          UPDATE life_items
          SET status = 'ARCHIVED', updated_at = now()
          WHERE owner_user_id = ${userId}
            AND kind = 'PILLAR'
            AND status = 'ACTIVE'
            AND visibility = 'PRIVATE'
        `;

        let order = 0;
        for (const area of body.areas) {
          await tx`
            INSERT INTO life_items (
              owner_user_id, household_id, parent_id, kind, visibility,
              title, status, body, sort_order
            ) VALUES (
              ${userId},
              NULL,
              NULL,
              'PILLAR',
              'PRIVATE',
              ${area.title},
              'ACTIVE',
              ${tx.json({ icon: area.icon ?? 'compass-outline' })},
              ${order}
            )
          `;
          order += 1;
        }

        const [capacity] = await tx<{ id: string }[]>`
          SELECT id FROM life_items
          WHERE owner_user_id = ${userId}
            AND kind = 'VISION'
            AND title = 'Weekly capacity'
          LIMIT 1
        `;
        if (!capacity) {
          await tx`
            INSERT INTO life_items (
              owner_user_id, kind, visibility, title, status, body, sort_order
            ) VALUES (
              ${userId}, 'VISION', 'PRIVATE', 'Weekly capacity', 'ACTIVE',
              ${tx.json({ availableHours: 11 })}, 100
            )
          `;
        }

        await tx`
          UPDATE users
          SET
            onboarding_completed_at = now(),
            preferred_currency = COALESCE(${body.preferredCurrency ?? null}, preferred_currency),
            updated_at = now()
          WHERE id = ${userId}
        `;
      });

      return helpers.getAccountPayload(sql, userId);
    },
  );

  app.get('/v1/budgets', { preHandler: auth.authenticate }, async (request) => {
    const userId = (request as { authUser: AuthUser }).authUser.id;
    return sql`
      SELECT b.*
      FROM budgets b
      WHERE
        b.owner_user_id = ${userId}
        OR (
          b.visibility = 'SHARED'
          AND EXISTS (
            SELECT 1 FROM household_members hm
            WHERE hm.household_id = b.household_id
              AND hm.user_id = ${userId}
          )
        )
      ORDER BY b.updated_at DESC
    `;
  });

  app.post('/v1/budgets', { preHandler: auth.authenticate }, async (request, reply) => {
    const userId = (request as { authUser: AuthUser }).authUser.id;
    const body = z
      .object({
        name: z.string().trim().min(1).max(120),
        visibility: z.enum(['PRIVATE', 'SHARED']).default('PRIVATE'),
        currency: z.string().trim().min(3).max(8).optional(),
        period: z.enum(['weekly', 'monthly']).default('monthly'),
        seedCategories: z.boolean().default(true),
      })
      .parse(request.body);

    const user = await helpers.getUser(sql, userId);
    const currency = (body.currency ?? user.preferredCurrency ?? 'GBP').toUpperCase();
    const householdId = body.visibility === 'SHARED' ? user.activeHouseholdId : null;
    if (body.visibility === 'SHARED' && !householdId) {
      throw new ApiError(400, 'no_active_household', 'Choose a household before sharing.');
    }
    if (body.visibility === 'SHARED' && householdId) {
      const members = await sql<{ count: string }[]>`
        SELECT COUNT(*)::text AS count
        FROM household_members
        WHERE household_id = ${householdId}
      `;
      if (Number(members[0]?.count ?? 0) < 2) {
        throw new ApiError(
          400,
          'partner_required',
          'Link a partner before creating a shared budget.',
        );
      }
    }

    const budget = await sql.begin(async (tx) => {
      const [created] = await tx`
        INSERT INTO budgets (
          owner_user_id, household_id, visibility, name, currency, period
        ) VALUES (
          ${userId}, ${householdId}, ${body.visibility}, ${body.name},
          ${currency}, ${body.period}
        )
        RETURNING *
      `;
      if (!created) {
        throw new ApiError(500, 'budget_create_failed', 'Could not create budget.');
      }
      if (body.seedCategories) {
        let order = 0;
        for (const name of DEFAULT_BUDGET_CATEGORIES) {
          await tx`
            INSERT INTO budget_categories (budget_id, name, planned_cents, sort_order)
            VALUES (${created.id}, ${name}, 0, ${order})
          `;
          order += 1;
        }
      }
      return created;
    });

    return reply.code(201).send(await budgetDetail(sql, budget.id));
  });

  app.get('/v1/budgets/:id', { preHandler: auth.authenticate }, async (request) => {
    const userId = (request as { authUser: AuthUser }).authUser.id;
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await assertBudgetAccess(sql, userId, id);
    return budgetDetail(sql, id);
  });

  app.patch('/v1/budgets/:id', { preHandler: auth.authenticate }, async (request) => {
    const userId = (request as { authUser: AuthUser }).authUser.id;
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await assertBudgetAccess(sql, userId, id, true);
    const body = z
      .object({
        name: z.string().trim().min(1).max(120).optional(),
        currency: z.string().trim().min(3).max(8).optional(),
        period: z.enum(['weekly', 'monthly']).optional(),
        payFrequency: z
          .enum(['weekly', 'biweekly', 'four_weekly', 'monthly'])
          .nullable()
          .optional(),
        nextPayDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .optional(),
        typicalPayCents: z.number().int().min(0).nullable().optional(),
      })
      .refine((value) => Object.keys(value).length > 0)
      .parse(request.body);

    await sql`
      UPDATE budgets SET
        name = COALESCE(${body.name ?? null}, name),
        currency = COALESCE(${body.currency?.toUpperCase() ?? null}, currency),
        period = COALESCE(${body.period ?? null}, period),
        pay_frequency = CASE
          WHEN ${body.payFrequency !== undefined} THEN ${body.payFrequency ?? null}
          ELSE pay_frequency
        END,
        next_pay_date = CASE
          WHEN ${body.nextPayDate !== undefined} THEN ${body.nextPayDate ?? null}
          ELSE next_pay_date
        END,
        typical_pay_cents = CASE
          WHEN ${body.typicalPayCents !== undefined} THEN ${body.typicalPayCents ?? null}
          ELSE typical_pay_cents
        END,
        updated_at = now()
      WHERE id = ${id}
    `;
    return budgetDetail(sql, id);
  });

  app.delete('/v1/budgets/:id', { preHandler: auth.authenticate }, async (request, reply) => {
    const userId = (request as { authUser: AuthUser }).authUser.id;
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await assertBudgetAccess(sql, userId, id, true);
    await sql`DELETE FROM budgets WHERE id = ${id}`;
    return reply.code(204).send();
  });

  app.post(
    '/v1/budgets/:id/categories',
    { preHandler: auth.authenticate },
    async (request, reply) => {
      const userId = (request as { authUser: AuthUser }).authUser.id;
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      await assertBudgetAccess(sql, userId, id);
      const body = z
        .object({
          name: z.string().trim().min(1).max(80),
          plannedCents: z.number().int().min(0).default(0),
        })
        .parse(request.body);

      const [category] = await sql`
        INSERT INTO budget_categories (budget_id, name, planned_cents, sort_order)
        VALUES (
          ${id},
          ${body.name},
          ${body.plannedCents},
          (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM budget_categories WHERE budget_id = ${id})
        )
        RETURNING *
      `;
      await sql`UPDATE budgets SET updated_at = now() WHERE id = ${id}`;
      return reply.code(201).send(category);
    },
  );

  app.patch(
    '/v1/budgets/:id/categories/:categoryId',
    { preHandler: auth.authenticate },
    async (request) => {
      const userId = (request as { authUser: AuthUser }).authUser.id;
      const params = z
        .object({ id: z.string().uuid(), categoryId: z.string().uuid() })
        .parse(request.params);
      await assertBudgetAccess(sql, userId, params.id);
      const body = z
        .object({
          name: z.string().trim().min(1).max(80).optional(),
          plannedCents: z.number().int().min(0).optional(),
        })
        .refine((value) => Object.keys(value).length > 0)
        .parse(request.body);

      const [category] = await sql`
        UPDATE budget_categories SET
          name = COALESCE(${body.name ?? null}, name),
          planned_cents = COALESCE(${body.plannedCents ?? null}, planned_cents)
        WHERE id = ${params.categoryId} AND budget_id = ${params.id}
        RETURNING *
      `;
      if (!category) throw new ApiError(404, 'category_not_found', 'Category not found.');
      await sql`UPDATE budgets SET updated_at = now() WHERE id = ${params.id}`;
      return category;
    },
  );

  app.delete(
    '/v1/budgets/:id/categories/:categoryId',
    { preHandler: auth.authenticate },
    async (request, reply) => {
      const userId = (request as { authUser: AuthUser }).authUser.id;
      const params = z
        .object({ id: z.string().uuid(), categoryId: z.string().uuid() })
        .parse(request.params);
      await assertBudgetAccess(sql, userId, params.id);
      const result = await sql`
        DELETE FROM budget_categories
        WHERE id = ${params.categoryId} AND budget_id = ${params.id}
        RETURNING id
      `;
      if (result.count === 0) {
        throw new ApiError(404, 'category_not_found', 'Category not found.');
      }
      return reply.code(204).send();
    },
  );

  app.post(
    '/v1/budgets/:id/entries',
    { preHandler: auth.authenticate },
    async (request, reply) => {
      const userId = (request as { authUser: AuthUser }).authUser.id;
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      await assertBudgetAccess(sql, userId, id);
      const body = z
        .object({
          kind: z.enum(['INCOME', 'EXPENSE']),
          amountCents: z.number().int().positive(),
          categoryId: z.string().uuid().nullable().optional(),
          note: z.string().trim().max(500).default(''),
          occurredOn: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        })
        .parse(request.body);

      if (body.categoryId) {
        const [category] = await sql<{ id: string }[]>`
          SELECT id FROM budget_categories
          WHERE id = ${body.categoryId} AND budget_id = ${id}
        `;
        if (!category) {
          throw new ApiError(400, 'invalid_category', 'Category does not belong to this budget.');
        }
      }

      const occurredOn =
        body.occurredOn ?? new Date().toISOString().slice(0, 10);

      const [entry] = await sql`
        INSERT INTO budget_entries (
          budget_id, category_id, created_by, kind, amount_cents, note, occurred_on
        ) VALUES (
          ${id},
          ${body.categoryId ?? null},
          ${userId},
          ${body.kind},
          ${body.amountCents},
          ${body.note},
          ${occurredOn}
        )
        RETURNING *
      `;
      await sql`UPDATE budgets SET updated_at = now() WHERE id = ${id}`;
      return reply.code(201).send(entry);
    },
  );

  app.delete(
    '/v1/budgets/:id/entries/:entryId',
    { preHandler: auth.authenticate },
    async (request, reply) => {
      const userId = (request as { authUser: AuthUser }).authUser.id;
      const params = z
        .object({ id: z.string().uuid(), entryId: z.string().uuid() })
        .parse(request.params);
      await assertBudgetAccess(sql, userId, params.id);
      const result = await sql`
        DELETE FROM budget_entries
        WHERE id = ${params.entryId} AND budget_id = ${params.id}
        RETURNING id
      `;
      if (result.count === 0) {
        throw new ApiError(404, 'entry_not_found', 'Entry not found.');
      }
      return reply.code(204).send();
    },
  );

  app.get(
    '/v1/budgets/:id/recurring',
    { preHandler: auth.authenticate },
    async (request) => {
      const userId = (request as { authUser: AuthUser }).authUser.id;
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      await assertBudgetAccess(sql, userId, id);
      return listRecurring(sql, id);
    },
  );

  app.post(
    '/v1/budgets/:id/recurring',
    { preHandler: auth.authenticate },
    async (request, reply) => {
      const userId = (request as { authUser: AuthUser }).authUser.id;
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      await assertBudgetAccess(sql, userId, id);
      const body = z
        .object({
          name: z.string().trim().min(1).max(120),
          amountCents: z.number().int().positive(),
          cadence: z.enum(['weekly', 'biweekly', 'four_weekly', 'monthly', 'yearly']),
          dayOfMonth: z.number().int().min(1).max(28).nullable().optional(),
          weekday: z.number().int().min(0).max(6).nullable().optional(),
          anchorDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .nullable()
            .optional(),
          categoryId: z.string().uuid().nullable().optional(),
          active: z.boolean().default(true),
        })
        .parse(request.body);
      assertRecurringCadence(body);

      if (body.categoryId) {
        const [category] = await sql<{ id: string }[]>`
          SELECT id FROM budget_categories
          WHERE id = ${body.categoryId} AND budget_id = ${id}
        `;
        if (!category) {
          throw new ApiError(400, 'invalid_category', 'Category does not belong to this budget.');
        }
      }

      const [row] = await sql`
        INSERT INTO budget_recurring_outgoings (
          budget_id, category_id, name, amount_cents, cadence,
          day_of_month, weekday, anchor_date, active
        ) VALUES (
          ${id},
          ${body.categoryId ?? null},
          ${body.name},
          ${body.amountCents},
          ${body.cadence},
          ${
            body.cadence === 'monthly' || body.cadence === 'yearly'
              ? (body.dayOfMonth ?? null)
              : null
          },
          ${body.cadence === 'weekly' ? (body.weekday ?? null) : null},
          ${
            body.cadence === 'biweekly' || body.cadence === 'four_weekly'
              ? (body.anchorDate ?? null)
              : null
          },
          ${body.active}
        )
        RETURNING *
      `;
      await sql`UPDATE budgets SET updated_at = now() WHERE id = ${id}`;
      return reply.code(201).send(row);
    },
  );

  app.patch(
    '/v1/budgets/:id/recurring/:recurringId',
    { preHandler: auth.authenticate },
    async (request) => {
      const userId = (request as { authUser: AuthUser }).authUser.id;
      const params = z
        .object({ id: z.string().uuid(), recurringId: z.string().uuid() })
        .parse(request.params);
      await assertBudgetAccess(sql, userId, params.id);
      const body = z
        .object({
          name: z.string().trim().min(1).max(120).optional(),
          amountCents: z.number().int().positive().optional(),
          cadence: z
            .enum(['weekly', 'biweekly', 'four_weekly', 'monthly', 'yearly'])
            .optional(),
          dayOfMonth: z.number().int().min(1).max(28).nullable().optional(),
          weekday: z.number().int().min(0).max(6).nullable().optional(),
          anchorDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .nullable()
            .optional(),
          categoryId: z.string().uuid().nullable().optional(),
          active: z.boolean().optional(),
        })
        .refine((value) => Object.keys(value).length > 0)
        .parse(request.body);

      const [existing] = await sql<{
        cadence: 'weekly' | 'biweekly' | 'four_weekly' | 'monthly' | 'yearly';
        dayOfMonth: number | null;
        weekday: number | null;
        anchorDate: string | null;
      }[]>`
        SELECT cadence, day_of_month, weekday, anchor_date::text
        FROM budget_recurring_outgoings
        WHERE id = ${params.recurringId} AND budget_id = ${params.id}
      `;
      if (!existing) {
        throw new ApiError(404, 'recurring_not_found', 'Recurring outgoing not found.');
      }
      const nextCadence = body.cadence ?? existing.cadence;
      assertRecurringCadence({
        cadence: nextCadence,
        dayOfMonth:
          body.dayOfMonth !== undefined ? body.dayOfMonth : existing.dayOfMonth,
        weekday: body.weekday !== undefined ? body.weekday : existing.weekday,
        anchorDate:
          body.anchorDate !== undefined
            ? body.anchorDate
            : existing.anchorDate
              ? existing.anchorDate.slice(0, 10)
              : null,
      });

      const [row] = await sql`
        UPDATE budget_recurring_outgoings SET
          name = COALESCE(${body.name ?? null}, name),
          amount_cents = COALESCE(${body.amountCents ?? null}, amount_cents),
          cadence = COALESCE(${body.cadence ?? null}, cadence),
          day_of_month = CASE
            WHEN ${nextCadence === 'monthly' || nextCadence === 'yearly'} THEN
              COALESCE(${body.dayOfMonth ?? null}, day_of_month)
            ELSE NULL
          END,
          weekday = CASE
            WHEN ${nextCadence === 'weekly'} THEN
              COALESCE(${body.weekday ?? null}, weekday)
            ELSE NULL
          END,
          anchor_date = CASE
            WHEN ${nextCadence === 'biweekly' || nextCadence === 'four_weekly'} THEN
              COALESCE(${body.anchorDate ?? null}::date, anchor_date)
            ELSE NULL
          END,
          category_id = CASE
            WHEN ${body.categoryId !== undefined} THEN ${body.categoryId ?? null}
            ELSE category_id
          END,
          active = COALESCE(${body.active ?? null}, active),
          updated_at = now()
        WHERE id = ${params.recurringId} AND budget_id = ${params.id}
        RETURNING *
      `;
      await sql`UPDATE budgets SET updated_at = now() WHERE id = ${params.id}`;
      return row;
    },
  );

  app.delete(
    '/v1/budgets/:id/recurring/:recurringId',
    { preHandler: auth.authenticate },
    async (request, reply) => {
      const userId = (request as { authUser: AuthUser }).authUser.id;
      const params = z
        .object({ id: z.string().uuid(), recurringId: z.string().uuid() })
        .parse(request.params);
      await assertBudgetAccess(sql, userId, params.id);
      const result = await sql`
        DELETE FROM budget_recurring_outgoings
        WHERE id = ${params.recurringId} AND budget_id = ${params.id}
        RETURNING id
      `;
      if (result.count === 0) {
        throw new ApiError(404, 'recurring_not_found', 'Recurring outgoing not found.');
      }
      return reply.code(204).send();
    },
  );

  app.get(
    '/v1/budgets/:id/outgoings',
    { preHandler: auth.authenticate },
    async (request) => {
      const userId = (request as { authUser: AuthUser }).authUser.id;
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const budget = await assertBudgetAccess(sql, userId, id);
      const now = new Date();
      const query = z
        .object({
          year: z.coerce.number().int().min(2000).max(2100).default(now.getUTCFullYear()),
          month: z.coerce.number().int().min(1).max(12).default(now.getUTCMonth() + 1),
        })
        .parse(request.query);

      const [schedule] = await sql<{
        payFrequency: PayFrequency | null;
        nextPayDate: string | null;
        typicalPayCents: number | null;
        currency: string;
      }[]>`
        SELECT
          pay_frequency,
          next_pay_date::text,
          typical_pay_cents,
          currency
        FROM budgets
        WHERE id = ${id}
      `;

      const categories = await sql<{ id: string; name: string }[]>`
        SELECT id, name FROM budget_categories WHERE budget_id = ${id}
      `;
      const categoryNames = new Map(categories.map((row) => [row.id, row.name]));

      const start = `${query.year}-${String(query.month).padStart(2, '0')}-01`;
      const endDay = daysInMonth(query.year, query.month);
      const end = `${query.year}-${String(query.month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

      const entries = await sql<
        {
          id: string;
          kind: 'INCOME' | 'EXPENSE';
          amountCents: number;
          note: string;
          occurredOn: string;
          categoryId: string | null;
        }[]
      >`
        SELECT
          id, kind, amount_cents, note, occurred_on::text, category_id
        FROM budget_entries
        WHERE budget_id = ${id}
          AND occurred_on >= ${start}::date
          AND occurred_on <= ${end}::date
        ORDER BY occurred_on ASC, created_at ASC
      `;

      const recurring = await listRecurring(sql, id);
      const projected = projectRecurringForMonth(query.year, query.month, recurring).map(
        (item) => ({
          ...item,
          categoryName: item.categoryId
            ? (categoryNames.get(item.categoryId) ?? null)
            : null,
        }),
      );

      // Prefer actual expense entries over duplicate recurring projection on same day+amount+name
      const entryItems: OutgoingItem[] = entries.map((entry) => ({
        id: entry.id,
        source: 'entry',
        kind: entry.kind,
        date: entry.occurredOn.slice(0, 10),
        amountCents: Number(entry.amountCents),
        title:
          entry.kind === 'INCOME'
            ? entry.note || 'Income'
            : categoryNames.get(entry.categoryId ?? '') || entry.note || 'Expense',
        note: entry.note,
        categoryId: entry.categoryId,
        categoryName: entry.categoryId
          ? (categoryNames.get(entry.categoryId) ?? null)
          : null,
        recurringId: null,
        savingGoalId: null,
        paid: true,
        paidAt: entry.occurredOn.slice(0, 10),
        paymentId: null,
      }));

      const covered = new Set(
        entryItems
          .filter((item) => item.kind === 'EXPENSE')
          .map(
            (item) =>
              `${item.date}|${item.amountCents}|${(item.title || '').toLowerCase()}`,
          ),
      );
      const recurringItems = projected.filter((item) => {
        const key = `${item.date}|${item.amountCents}|${item.title.toLowerCase()}`;
        return !covered.has(key);
      });

      const savingsGoals = await sql<
        {
          id: string;
          name: string;
          monthlyContributionCents: number;
          contributionDay: number;
        }[]
      >`
        SELECT
          id, name, monthly_contribution_cents, contribution_day
        FROM saving_goals
        WHERE monthly_contribution_cents IS NOT NULL
          AND contribution_day IS NOT NULL
          AND (
            owner_user_id = ${userId}
            OR (
              visibility = 'SHARED'
              AND EXISTS (
                SELECT 1 FROM household_members hm
                WHERE hm.household_id = saving_goals.household_id
                  AND hm.user_id = ${userId}
              )
            )
          )
      `;

      const savingItems: OutgoingItem[] = savingsGoals.map((goal) => {
        const day = Math.min(goal.contributionDay, endDay);
        const date = `${query.year}-${String(query.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return {
          id: `saving:${goal.id}:${date}`,
          source: 'saving' as const,
          kind: 'EXPENSE' as const,
          date,
          amountCents: Number(goal.monthlyContributionCents),
          title: `Savings · ${goal.name}`,
          note: 'monthly savings contribution',
          categoryId: null,
          categoryName: 'Savings',
          recurringId: null,
          savingGoalId: goal.id,
          paid: false,
          paidAt: null,
          paymentId: null,
        };
      });

      const payments = await sql<
        {
          id: string;
          sourceType: 'recurring_outgoing' | 'saving_goal';
          sourceId: string;
          dueDate: string;
          paidAt: string;
        }[]
      >`
        SELECT
          id,
          source_type,
          source_id,
          due_date::text,
          paid_at::text
        FROM payment_occurrences
        WHERE owner_user_id = ${userId}
          AND due_date >= ${start}::date
          AND due_date <= ${end}::date
          AND (
            budget_id = ${id}
            OR source_type = 'saving_goal'
          )
      `;
      const paymentByKey = new Map(
        payments.map((row) => [
          `${row.sourceType}:${row.sourceId}:${row.dueDate.slice(0, 10)}`,
          row,
        ]),
      );

      const withPaidStatus = (item: OutgoingItem): OutgoingItem => {
        if (item.source === 'entry') return item;
        const key =
          item.source === 'recurring' && item.recurringId
            ? `recurring_outgoing:${item.recurringId}:${item.date}`
            : item.source === 'saving' && item.savingGoalId
              ? `saving_goal:${item.savingGoalId}:${item.date}`
              : null;
        if (!key) return item;
        const payment = paymentByKey.get(key);
        if (!payment) return item;
        return {
          ...item,
          paid: true,
          paidAt: payment.paidAt,
          paymentId: payment.id,
        };
      };

      const list = [...entryItems, ...recurringItems, ...savingItems]
        .map(withPaidStatus)
        .sort((a, b) =>
          a.date === b.date
            ? b.amountCents - a.amountCents
            : a.date.localeCompare(b.date),
        );

      const payDates = payDatesInMonth(
        query.year,
        query.month,
        schedule?.payFrequency,
        schedule?.nextPayDate,
      );
      const paySet = new Set(payDates);

      const days = [];
      for (let day = 1; day <= endDay; day += 1) {
        const date = `${query.year}-${String(query.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const items = list.filter((item) => item.date === date);
        days.push({
          date,
          isPayDay: paySet.has(date),
          totalCents: items
            .filter((item) => item.kind === 'EXPENSE')
            .reduce((sum, item) => sum + item.amountCents, 0),
          incomeCents: items
            .filter((item) => item.kind === 'INCOME')
            .reduce((sum, item) => sum + item.amountCents, 0),
          items,
        });
      }

      const expenseCents = list
        .filter((item) => item.kind === 'EXPENSE')
        .reduce((sum, item) => sum + item.amountCents, 0);
      const incomeCents = list
        .filter((item) => item.kind === 'INCOME')
        .reduce((sum, item) => sum + item.amountCents, 0);
      const recurringCents = list
        .filter((item) => item.kind === 'EXPENSE' && item.source === 'recurring')
        .reduce((sum, item) => sum + item.amountCents, 0);
      const outstandingCents = list
        .filter(
          (item) =>
            item.kind === 'EXPENSE' &&
            (item.source === 'recurring' || item.source === 'saving') &&
            !item.paid,
        )
        .reduce((sum, item) => sum + item.amountCents, 0);
      const paidTrackedCents = list
        .filter(
          (item) =>
            item.kind === 'EXPENSE' &&
            (item.source === 'recurring' || item.source === 'saving') &&
            item.paid,
        )
        .reduce((sum, item) => sum + item.amountCents, 0);

      const recommendations = buildRecommendations({
        currency: schedule?.currency ?? budget.currency,
        payFrequency: schedule?.payFrequency ?? null,
        typicalPayCents: schedule?.typicalPayCents ?? null,
        payDates,
        list,
        recurring,
      });

      return {
        budgetId: id,
        year: query.year,
        month: query.month,
        currency: schedule?.currency ?? budget.currency,
        paySchedule: {
          frequency: schedule?.payFrequency ?? null,
          nextPayDate: schedule?.nextPayDate ?? null,
          typicalPayCents: schedule?.typicalPayCents ?? null,
          payDates,
        },
        days,
        list: list.filter((item) => item.kind === 'EXPENSE'),
        totals: {
          expenseCents,
          incomeCents,
          recurringCents,
          oneOffCents: expenseCents - recurringCents,
          outstandingCents,
          paidTrackedCents,
        },
        recommendations,
        flags: recommendations.filter((item) => item.flagged),
        generatedOn: toDateString(new Date()),
      };
    },
  );

  app.post(
    '/v1/budgets/:id/payments',
    { preHandler: auth.authenticate },
    async (request, reply) => {
      const userId = (request as { authUser: AuthUser }).authUser.id;
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      await assertBudgetAccess(sql, userId, id);
      const body = z
        .object({
          sourceType: z.enum(['recurring_outgoing', 'saving_goal']),
          sourceId: z.string().uuid(),
          dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          note: z.string().trim().max(500).optional(),
        })
        .parse(request.body);

      let amountCents = 0;
      let title = '';

      if (body.sourceType === 'recurring_outgoing') {
        const [row] = await sql<
          { id: string; name: string; amountCents: number }[]
        >`
          SELECT id, name, amount_cents
          FROM budget_recurring_outgoings
          WHERE id = ${body.sourceId} AND budget_id = ${id} AND active = true
        `;
        if (!row) {
          throw new ApiError(
            404,
            'recurring_not_found',
            'Recurring outgoing not found on this budget.',
          );
        }
        amountCents = Number(row.amountCents);
        title = row.name;
      } else {
        const [row] = await sql<
          {
            id: string;
            name: string;
            monthlyContributionCents: number | null;
          }[]
        >`
          SELECT id, name, monthly_contribution_cents
          FROM saving_goals
          WHERE id = ${body.sourceId}
            AND (
              owner_user_id = ${userId}
              OR (
                visibility = 'SHARED'
                AND EXISTS (
                  SELECT 1 FROM household_members hm
                  WHERE hm.household_id = saving_goals.household_id
                    AND hm.user_id = ${userId}
                )
              )
            )
        `;
        if (!row || row.monthlyContributionCents == null) {
          throw new ApiError(
            404,
            'saving_goal_not_found',
            'Saving goal with a monthly contribution was not found.',
          );
        }
        amountCents = Number(row.monthlyContributionCents);
        title = `Savings · ${row.name}`;
      }

      const [payment] = await sql`
        INSERT INTO payment_occurrences (
          owner_user_id, budget_id, source_type, source_id,
          due_date, amount_cents, title, paid_by, note
        ) VALUES (
          ${userId},
          ${body.sourceType === 'recurring_outgoing' ? id : null},
          ${body.sourceType},
          ${body.sourceId},
          ${body.dueDate}::date,
          ${amountCents},
          ${title},
          ${userId},
          ${body.note ?? ''}
        )
        ON CONFLICT (source_type, source_id, due_date) DO UPDATE SET
          paid_at = now(),
          paid_by = EXCLUDED.paid_by,
          amount_cents = EXCLUDED.amount_cents,
          title = EXCLUDED.title,
          note = EXCLUDED.note,
          budget_id = EXCLUDED.budget_id
        RETURNING *
      `;
      return reply.code(201).send(payment);
    },
  );

  app.delete(
    '/v1/budgets/:id/payments/:paymentId',
    { preHandler: auth.authenticate },
    async (request, reply) => {
      const userId = (request as { authUser: AuthUser }).authUser.id;
      const params = z
        .object({ id: z.string().uuid(), paymentId: z.string().uuid() })
        .parse(request.params);
      await assertBudgetAccess(sql, userId, params.id);
      const result = await sql`
        DELETE FROM payment_occurrences
        WHERE id = ${params.paymentId}
          AND owner_user_id = ${userId}
          AND (
            budget_id = ${params.id}
            OR (budget_id IS NULL AND source_type = 'saving_goal')
          )
        RETURNING id
      `;
      if (result.count === 0) {
        throw new ApiError(404, 'payment_not_found', 'Payment record not found.');
      }
      return reply.code(204).send();
    },
  );
}

export { ApiError as BudgetApiError };
