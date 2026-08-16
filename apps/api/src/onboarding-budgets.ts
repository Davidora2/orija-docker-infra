import { ApiError } from './errors.js';
import type { Database } from './db.js';
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
          SET onboarding_completed_at = now(), updated_at = now()
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
        currency: z.string().trim().min(3).max(8).default('GBP'),
        period: z.enum(['weekly', 'monthly']).default('monthly'),
        seedCategories: z.boolean().default(true),
      })
      .parse(request.body);

    const user = await helpers.getUser(sql, userId);
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
          ${body.currency.toUpperCase()}, ${body.period}
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
      })
      .refine((value) => Object.keys(value).length > 0)
      .parse(request.body);

    await sql`
      UPDATE budgets SET
        name = COALESCE(${body.name ?? null}, name),
        currency = COALESCE(${body.currency?.toUpperCase() ?? null}, currency),
        period = COALESCE(${body.period ?? null}, period),
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
}

export { ApiError as BudgetApiError };
