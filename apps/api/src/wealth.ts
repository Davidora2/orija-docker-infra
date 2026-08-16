import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Database } from './db.js';
import { ApiError } from './errors.js';

type AuthUser = { id: string; email: string };

const visibilitySchema = z.enum(['PRIVATE', 'SHARED']);

const savingCategorySchema = z.enum([
  'emergency',
  'six_month_salary',
  'holiday',
  'house_deposit',
  'custom',
]);

const investmentTypeSchema = z.enum([
  'fhsa',
  'tfsa',
  'rrsp',
  'isa',
  'stocks',
  'crypto',
  'pension',
  'other',
]);

export const SAVING_CATEGORY_LABELS: Record<
  z.infer<typeof savingCategorySchema>,
  string
> = {
  emergency: 'Emergency fund',
  six_month_salary: '6-month salary',
  holiday: 'Holiday',
  house_deposit: 'House deposit',
  custom: 'Custom',
};

export const INVESTMENT_TYPE_LABELS: Record<
  z.infer<typeof investmentTypeSchema>,
  string
> = {
  fhsa: 'FHSA',
  tfsa: 'TFSA',
  rrsp: 'RRSP',
  isa: 'ISA',
  stocks: 'Stocks / brokerage',
  crypto: 'Crypto',
  pension: 'Pension',
  other: 'Other',
};

export const SUPPORTED_CURRENCIES = [
  'GBP',
  'USD',
  'CAD',
  'EUR',
  'AUD',
  'NZD',
  'CHF',
  'JPY',
] as const;

type WealthHelpers = {
  getUser: (sql: Database, userId: string) => Promise<{
    id: string;
    activeHouseholdId: string | null;
    preferredCurrency?: string;
  }>;
};

async function resolveHousehold(
  sql: Database,
  userId: string,
  visibility: 'PRIVATE' | 'SHARED',
  getUser: (sql: Database, userId: string) => Promise<{
    id: string;
    activeHouseholdId: string | null;
  }>,
): Promise<string | null> {
  if (visibility === 'PRIVATE') return null;
  const user = await getUser(sql, userId);
  if (!user.activeHouseholdId) {
    throw new ApiError(400, 'no_active_household', 'Choose a household first.');
  }
  const members = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM household_members
    WHERE household_id = ${user.activeHouseholdId}
  `;
  if ((members[0]?.count ?? 0) < 2) {
    throw new ApiError(
      400,
      'household_too_small',
      'Shared wealth needs a linked partner.',
    );
  }
  return user.activeHouseholdId;
}

async function assertWealthAccess(
  sql: Database,
  userId: string,
  table: 'saving_goals' | 'investment_accounts',
  id: string,
): Promise<{ ownerUserId: string }> {
  if (table === 'saving_goals') {
    const [row] = await sql<{ ownerUserId: string }[]>`
      SELECT owner_user_id
      FROM saving_goals
      WHERE id = ${id}
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
    if (!row) throw new ApiError(404, 'not_found', 'Item not found.');
    return row;
  }
  const [row] = await sql<{ ownerUserId: string }[]>`
    SELECT owner_user_id
    FROM investment_accounts
    WHERE id = ${id}
      AND (
        owner_user_id = ${userId}
        OR (
          visibility = 'SHARED'
          AND EXISTS (
            SELECT 1 FROM household_members hm
            WHERE hm.household_id = investment_accounts.household_id
              AND hm.user_id = ${userId}
          )
        )
      )
  `;
  if (!row) throw new ApiError(404, 'not_found', 'Item not found.');
  return row;
}

export function registerWealthRoutes(
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
  },
): void {
  app.get('/v1/currencies', async () => ({
    currencies: SUPPORTED_CURRENCIES,
  }));

  app.get('/v1/wealth/meta', async () => ({
    savingCategories: Object.entries(SAVING_CATEGORY_LABELS).map(([id, label]) => ({
      id,
      label,
    })),
    investmentTypes: Object.entries(INVESTMENT_TYPE_LABELS).map(([id, label]) => ({
      id,
      label,
    })),
    currencies: SUPPORTED_CURRENCIES,
  }));

  app.get('/v1/saving-goals', { preHandler: auth.authenticate }, async (request) => {
    const userId = (request as { authUser: AuthUser }).authUser.id;
    return sql`
      SELECT *
      FROM saving_goals
      WHERE
        owner_user_id = ${userId}
        OR (
          visibility = 'SHARED'
          AND EXISTS (
            SELECT 1 FROM household_members hm
            WHERE hm.household_id = saving_goals.household_id
              AND hm.user_id = ${userId}
          )
        )
      ORDER BY sort_order ASC, updated_at DESC
    `;
  });

  app.post('/v1/saving-goals', { preHandler: auth.authenticate }, async (request, reply) => {
    const userId = (request as { authUser: AuthUser }).authUser.id;
    const body = z
      .object({
        name: z.string().trim().min(1).max(120),
        category: savingCategorySchema,
        customLabel: z.string().trim().min(1).max(80).optional(),
        targetCents: z.number().int().min(0).default(0),
        currentCents: z.number().int().min(0).default(0),
        visibility: visibilitySchema.default('PRIVATE'),
        monthlyContributionCents: z.number().int().positive().nullable().optional(),
        contributionDay: z.number().int().min(1).max(28).nullable().optional(),
      })
      .superRefine((value, ctx) => {
        const hasAmount = value.monthlyContributionCents != null;
        const hasDay = value.contributionDay != null;
        if (hasAmount !== hasDay) {
          ctx.addIssue({
            code: 'custom',
            message:
              'Monthly contribution amount and contribution day must be set together.',
          });
        }
      })
      .parse(request.body);

    if (body.category === 'custom' && !body.customLabel) {
      throw new ApiError(400, 'custom_label_required', 'Custom savings need a label.');
    }

    const householdId = await resolveHousehold(
      sql,
      userId,
      body.visibility,
      helpers.getUser,
    );
    const [row] = await sql`
      INSERT INTO saving_goals (
        owner_user_id, household_id, visibility, category, custom_label,
        name, target_cents, current_cents,
        monthly_contribution_cents, contribution_day
      ) VALUES (
        ${userId},
        ${householdId},
        ${body.visibility},
        ${body.category},
        ${body.category === 'custom' ? body.customLabel! : null},
        ${body.name},
        ${body.targetCents},
        ${body.currentCents},
        ${body.monthlyContributionCents ?? null},
        ${body.contributionDay ?? null}
      )
      RETURNING *
    `;
    return reply.code(201).send(row);
  });

  app.patch('/v1/saving-goals/:id', { preHandler: auth.authenticate }, async (request) => {
    const userId = (request as { authUser: AuthUser }).authUser.id;
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await assertWealthAccess(sql, userId, 'saving_goals', id);
    const body = z
      .object({
        name: z.string().trim().min(1).max(120).optional(),
        category: savingCategorySchema.optional(),
        customLabel: z.string().trim().min(1).max(80).nullable().optional(),
        targetCents: z.number().int().min(0).optional(),
        currentCents: z.number().int().min(0).optional(),
        sortOrder: z.number().int().optional(),
        monthlyContributionCents: z.number().int().positive().nullable().optional(),
        contributionDay: z.number().int().min(1).max(28).nullable().optional(),
      })
      .refine((value) => Object.keys(value).length > 0)
      .parse(request.body);

    const [existing] = await sql<
      {
        monthlyContributionCents: number | null;
        contributionDay: number | null;
      }[]
    >`
      SELECT monthly_contribution_cents, contribution_day
      FROM saving_goals
      WHERE id = ${id}
    `;
    const nextAmount =
      body.monthlyContributionCents !== undefined
        ? body.monthlyContributionCents
        : existing?.monthlyContributionCents ?? null;
    const nextDay =
      body.contributionDay !== undefined
        ? body.contributionDay
        : existing?.contributionDay ?? null;
    if ((nextAmount == null) !== (nextDay == null)) {
      throw new ApiError(
        400,
        'contribution_schedule_incomplete',
        'Monthly contribution amount and contribution day must be set together.',
      );
    }

    const [row] = await sql`
      UPDATE saving_goals SET
        name = COALESCE(${body.name ?? null}, name),
        category = COALESCE(${body.category ?? null}, category),
        custom_label = CASE
          WHEN ${body.customLabel !== undefined} THEN ${body.customLabel ?? null}
          ELSE custom_label
        END,
        target_cents = COALESCE(${body.targetCents ?? null}, target_cents),
        current_cents = COALESCE(${body.currentCents ?? null}, current_cents),
        sort_order = COALESCE(${body.sortOrder ?? null}, sort_order),
        monthly_contribution_cents = CASE
          WHEN ${body.monthlyContributionCents !== undefined}
            THEN ${body.monthlyContributionCents ?? null}
          ELSE monthly_contribution_cents
        END,
        contribution_day = CASE
          WHEN ${body.contributionDay !== undefined}
            THEN ${body.contributionDay ?? null}
          ELSE contribution_day
        END,
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    return row;
  });

  app.delete(
    '/v1/saving-goals/:id',
    { preHandler: auth.authenticate },
    async (request, reply) => {
      const userId = (request as { authUser: AuthUser }).authUser.id;
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const existing = await assertWealthAccess(sql, userId, 'saving_goals', id);
      if (existing.ownerUserId !== userId) {
        throw new ApiError(403, 'not_owner', 'Only the owner can delete this goal.');
      }
      await sql`DELETE FROM saving_goals WHERE id = ${id}`;
      return reply.code(204).send();
    },
  );

  app.get(
    '/v1/investments',
    { preHandler: auth.authenticate },
    async (request) => {
      const userId = (request as { authUser: AuthUser }).authUser.id;
      return sql`
        SELECT *
        FROM investment_accounts
        WHERE
          owner_user_id = ${userId}
          OR (
            visibility = 'SHARED'
            AND EXISTS (
              SELECT 1 FROM household_members hm
              WHERE hm.household_id = investment_accounts.household_id
                AND hm.user_id = ${userId}
            )
          )
        ORDER BY sort_order ASC, updated_at DESC
      `;
    },
  );

  app.post('/v1/investments', { preHandler: auth.authenticate }, async (request, reply) => {
    const userId = (request as { authUser: AuthUser }).authUser.id;
    const body = z
      .object({
        name: z.string().trim().min(1).max(120),
        accountType: investmentTypeSchema,
        customLabel: z.string().trim().min(1).max(80).optional(),
        goalCents: z.number().int().min(0).default(0),
        currentCents: z.number().int().min(0).default(0),
        visibility: visibilitySchema.default('PRIVATE'),
      })
      .parse(request.body);

    if (body.accountType === 'other' && !body.customLabel) {
      throw new ApiError(400, 'custom_label_required', 'Other portfolios need a label.');
    }

    const householdId = await resolveHousehold(
      sql,
      userId,
      body.visibility,
      helpers.getUser,
    );
    const [row] = await sql`
      INSERT INTO investment_accounts (
        owner_user_id, household_id, visibility, account_type, custom_label,
        name, goal_cents, current_cents
      ) VALUES (
        ${userId},
        ${householdId},
        ${body.visibility},
        ${body.accountType},
        ${body.accountType === 'other' ? body.customLabel! : null},
        ${body.name},
        ${body.goalCents},
        ${body.currentCents}
      )
      RETURNING *
    `;
    return reply.code(201).send(row);
  });

  app.patch('/v1/investments/:id', { preHandler: auth.authenticate }, async (request) => {
    const userId = (request as { authUser: AuthUser }).authUser.id;
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await assertWealthAccess(sql, userId, 'investment_accounts', id);
    const body = z
      .object({
        name: z.string().trim().min(1).max(120).optional(),
        accountType: investmentTypeSchema.optional(),
        customLabel: z.string().trim().min(1).max(80).nullable().optional(),
        goalCents: z.number().int().min(0).optional(),
        currentCents: z.number().int().min(0).optional(),
        sortOrder: z.number().int().optional(),
      })
      .refine((value) => Object.keys(value).length > 0)
      .parse(request.body);

    const [row] = await sql`
      UPDATE investment_accounts SET
        name = COALESCE(${body.name ?? null}, name),
        account_type = COALESCE(${body.accountType ?? null}, account_type),
        custom_label = CASE
          WHEN ${body.customLabel !== undefined} THEN ${body.customLabel ?? null}
          ELSE custom_label
        END,
        goal_cents = COALESCE(${body.goalCents ?? null}, goal_cents),
        current_cents = COALESCE(${body.currentCents ?? null}, current_cents),
        sort_order = COALESCE(${body.sortOrder ?? null}, sort_order),
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    return row;
  });

  app.delete(
    '/v1/investments/:id',
    { preHandler: auth.authenticate },
    async (request, reply) => {
      const userId = (request as { authUser: AuthUser }).authUser.id;
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const existing = await assertWealthAccess(sql, userId, 'investment_accounts', id);
      if (existing.ownerUserId !== userId) {
        throw new ApiError(403, 'not_owner', 'Only the owner can delete this portfolio.');
      }
      await sql`DELETE FROM investment_accounts WHERE id = ${id}`;
      return reply.code(204).send();
    },
  );

  app.get('/v1/net-worth', { preHandler: auth.authenticate }, async (request) => {
    const userId = (request as { authUser: AuthUser }).authUser.id;
    const user = await helpers.getUser(sql, userId);
    const currency = user.preferredCurrency ?? 'GBP';

    const savings = await sql<{ currentCents: number; visibility: string }[]>`
      SELECT current_cents, visibility
      FROM saving_goals
      WHERE
        owner_user_id = ${userId}
        OR (
          visibility = 'SHARED'
          AND EXISTS (
            SELECT 1 FROM household_members hm
            WHERE hm.household_id = saving_goals.household_id
              AND hm.user_id = ${userId}
          )
        )
    `;
    const investments = await sql<{ currentCents: number; visibility: string }[]>`
      SELECT current_cents, visibility
      FROM investment_accounts
      WHERE
        owner_user_id = ${userId}
        OR (
          visibility = 'SHARED'
          AND EXISTS (
            SELECT 1 FROM household_members hm
            WHERE hm.household_id = investment_accounts.household_id
              AND hm.user_id = ${userId}
          )
        )
    `;

    const personalSavings = savings
      .filter((row) => row.visibility === 'PRIVATE')
      .reduce((sum, row) => sum + Number(row.currentCents), 0);
    const sharedSavings = savings
      .filter((row) => row.visibility === 'SHARED')
      .reduce((sum, row) => sum + Number(row.currentCents), 0);
    const personalInvestments = investments
      .filter((row) => row.visibility === 'PRIVATE')
      .reduce((sum, row) => sum + Number(row.currentCents), 0);
    const sharedInvestments = investments
      .filter((row) => row.visibility === 'SHARED')
      .reduce((sum, row) => sum + Number(row.currentCents), 0);

    const [budgetCash] = await sql<{ balanceCents: number }[]>`
      SELECT COALESCE(
        SUM(CASE WHEN kind = 'INCOME' THEN amount_cents ELSE -amount_cents END),
        0
      )::int AS balance_cents
      FROM budget_entries be
      JOIN budgets b ON b.id = be.budget_id
      WHERE b.owner_user_id = ${userId}
        AND b.visibility = 'PRIVATE'
    `;

    const personalNetWorth =
      personalSavings + personalInvestments + Number(budgetCash?.balanceCents ?? 0);
    const householdNetWorth = sharedSavings + sharedInvestments;
    const totalVisible = personalNetWorth + householdNetWorth;

    return {
      currency,
      personal: {
        savingsCents: personalSavings,
        investmentsCents: personalInvestments,
        budgetBalanceCents: Number(budgetCash?.balanceCents ?? 0),
        netWorthCents: personalNetWorth,
      },
      household: {
        savingsCents: sharedSavings,
        investmentsCents: sharedInvestments,
        netWorthCents: householdNetWorth,
        householdId: user.activeHouseholdId,
      },
      totalVisibleCents: totalVisible,
    };
  });

  // Draft monthly expenses (what-if)
  app.get(
    '/v1/budgets/:id/drafts',
    { preHandler: auth.authenticate },
    async (request) => {
      const userId = (request as { authUser: AuthUser }).authUser.id;
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      await assertBudgetAccess(sql, userId, id);
      return sql`
        SELECT *
        FROM budget_draft_expenses
        WHERE budget_id = ${id}
        ORDER BY active DESC, created_at DESC
      `;
    },
  );

  app.post(
    '/v1/budgets/:id/drafts',
    { preHandler: auth.authenticate },
    async (request, reply) => {
      const userId = (request as { authUser: AuthUser }).authUser.id;
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      await assertBudgetAccess(sql, userId, id);
      const body = z
        .object({
          name: z.string().trim().min(1).max(120),
          amountCents: z.number().int().positive(),
          categoryId: z.string().uuid().nullable().optional(),
          dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
          note: z.string().trim().max(500).optional(),
        })
        .parse(request.body);

      const [row] = await sql`
        INSERT INTO budget_draft_expenses (
          budget_id, created_by, name, amount_cents, category_id, day_of_month, note
        ) VALUES (
          ${id},
          ${userId},
          ${body.name},
          ${body.amountCents},
          ${body.categoryId ?? null},
          ${body.dayOfMonth ?? null},
          ${body.note ?? ''}
        )
        RETURNING *
      `;
      return reply.code(201).send(row);
    },
  );

  app.patch(
    '/v1/budgets/:id/drafts/:draftId',
    { preHandler: auth.authenticate },
    async (request) => {
      const userId = (request as { authUser: AuthUser }).authUser.id;
      const params = z
        .object({ id: z.string().uuid(), draftId: z.string().uuid() })
        .parse(request.params);
      await assertBudgetAccess(sql, userId, params.id);
      const body = z
        .object({
          name: z.string().trim().min(1).max(120).optional(),
          amountCents: z.number().int().positive().optional(),
          categoryId: z.string().uuid().nullable().optional(),
          dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
          note: z.string().trim().max(500).optional(),
          active: z.boolean().optional(),
        })
        .refine((value) => Object.keys(value).length > 0)
        .parse(request.body);

      const [row] = await sql`
        UPDATE budget_draft_expenses SET
          name = COALESCE(${body.name ?? null}, name),
          amount_cents = COALESCE(${body.amountCents ?? null}, amount_cents),
          category_id = CASE
            WHEN ${body.categoryId !== undefined} THEN ${body.categoryId ?? null}
            ELSE category_id
          END,
          day_of_month = CASE
            WHEN ${body.dayOfMonth !== undefined} THEN ${body.dayOfMonth ?? null}
            ELSE day_of_month
          END,
          note = COALESCE(${body.note ?? null}, note),
          active = COALESCE(${body.active ?? null}, active),
          updated_at = now()
        WHERE id = ${params.draftId} AND budget_id = ${params.id}
        RETURNING *
      `;
      if (!row) throw new ApiError(404, 'draft_not_found', 'Draft expense not found.');
      return row;
    },
  );

  app.delete(
    '/v1/budgets/:id/drafts/:draftId',
    { preHandler: auth.authenticate },
    async (request, reply) => {
      const userId = (request as { authUser: AuthUser }).authUser.id;
      const params = z
        .object({ id: z.string().uuid(), draftId: z.string().uuid() })
        .parse(request.params);
      await assertBudgetAccess(sql, userId, params.id);
      const result = await sql`
        DELETE FROM budget_draft_expenses
        WHERE id = ${params.draftId} AND budget_id = ${params.id}
        RETURNING id
      `;
      if (result.count === 0) {
        throw new ApiError(404, 'draft_not_found', 'Draft expense not found.');
      }
      return reply.code(204).send();
    },
  );

  app.get(
    '/v1/budgets/:id/draft-impact',
    { preHandler: auth.authenticate },
    async (request) => {
      const userId = (request as { authUser: AuthUser }).authUser.id;
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const budget = await assertBudgetAccess(sql, userId, id);

      const drafts = await sql<
        {
          id: string;
          name: string;
          amountCents: number;
          active: boolean;
          dayOfMonth: number | null;
        }[]
      >`
        SELECT id, name, amount_cents, active, day_of_month
        FROM budget_draft_expenses
        WHERE budget_id = ${id} AND active = true
      `;

      const draftCents = drafts.reduce((sum, row) => sum + Number(row.amountCents), 0);

      const [totals] = await sql<{ incomeCents: number; expenseCents: number }[]>`
        SELECT
          COALESCE(SUM(CASE WHEN kind = 'INCOME' THEN amount_cents ELSE 0 END), 0)::int AS income_cents,
          COALESCE(SUM(CASE WHEN kind = 'EXPENSE' THEN amount_cents ELSE 0 END), 0)::int AS expense_cents
        FROM budget_entries
        WHERE budget_id = ${id}
          AND occurred_on >= date_trunc('month', CURRENT_DATE)::date
          AND occurred_on < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date
      `;

      const recurring = await sql<{ amountCents: number; cadence: string }[]>`
        SELECT amount_cents, cadence
        FROM budget_recurring_outgoings
        WHERE budget_id = ${id} AND active = true
      `;
      const recurringCents = recurring.reduce((sum, row) => {
        if (row.cadence === 'weekly') return sum + Number(row.amountCents) * 4;
        if (row.cadence === 'yearly') return sum + Math.round(Number(row.amountCents) / 12);
        return sum + Number(row.amountCents);
      }, 0);

      const typicalPay = Number(budget.typicalPayCents ?? 0);
      const incomeCents = Number(totals?.incomeCents ?? 0);
      const expenseCents = Number(totals?.expenseCents ?? 0);
      const availableBase = (typicalPay || incomeCents) - recurringCents - expenseCents;
      const availableWithDrafts = availableBase - draftCents;

      return {
        budgetId: id,
        currency: budget.currency,
        drafts,
        impact: {
          typicalPayCents: typicalPay,
          monthIncomeCents: incomeCents,
          monthExpenseCents: expenseCents,
          recurringMonthlyCents: recurringCents,
          draftCents,
          remainingWithoutDraftsCents: availableBase,
          remainingWithDraftsCents: availableWithDrafts,
          wouldOverspend: availableWithDrafts < 0,
          overspendCents: availableWithDrafts < 0 ? Math.abs(availableWithDrafts) : 0,
        },
      };
    },
  );
}

async function assertBudgetAccess(
  sql: Database,
  userId: string,
  budgetId: string,
): Promise<{
  id: string;
  currency: string;
  typicalPayCents: number | null;
}> {
  const [budget] = await sql<
    { id: string; currency: string; typicalPayCents: number | null }[]
  >`
    SELECT id, currency, typical_pay_cents
    FROM budgets b
    WHERE b.id = ${budgetId}
      AND (
        b.owner_user_id = ${userId}
        OR (
          b.visibility = 'SHARED'
          AND EXISTS (
            SELECT 1 FROM household_members hm
            WHERE hm.household_id = b.household_id AND hm.user_id = ${userId}
          )
        )
      )
  `;
  if (!budget) throw new ApiError(404, 'budget_not_found', 'Budget not found.');
  return budget;
}
