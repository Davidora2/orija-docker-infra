import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { ApiError } from './errors.js';
import type { Database } from './db.js';
import {
  buildRecommendations,
  daysInMonth,
  listRecurring,
  payDatesInMonth,
  projectRecurringForMonth,
  type OutgoingItem,
  type PayFrequency,
  type RecurringOutgoing,
} from './budget-cashflow.js';

export type MoneyVisibilityGrant = 'SHARED_BILLS_ONLY' | 'FULL_VISIBILITY';

type AuthUser = { id: string };

type MemberRow = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'OWNER' | 'PARTNER';
  joinedAt: Date;
  moneyVisibilityGrant: MoneyVisibilityGrant;
};

export type AttributedOutgoingItem = OutgoingItem & {
  ownerUserId: string;
  ownerDisplayName: string;
  readOnly: boolean;
  sourceBudgetId: string;
  sourceVisibility: 'PRIVATE' | 'SHARED';
};

export type AttributedRecurringOutgoing = RecurringOutgoing & {
  ownerUserId: string;
  ownerDisplayName: string;
  readOnly: boolean;
  sourceVisibility: 'PRIVATE' | 'SHARED';
};

export async function getHouseholdMemberRows(
  sql: Database,
  householdId: string,
): Promise<MemberRow[]> {
  return sql<MemberRow[]>`
    SELECT
      u.id,
      u.email,
      u.display_name,
      u.avatar_url,
      hm.role,
      hm.joined_at,
      hm.money_visibility_grant
    FROM household_members hm
    JOIN users u ON u.id = hm.user_id
    WHERE hm.household_id = ${householdId}
    ORDER BY hm.joined_at ASC
  `;
}

export async function getVisibilityContext(
  sql: Database,
  householdId: string,
  viewerId: string,
): Promise<{
  yourGrant: MoneyVisibilityGrant;
  partnerGrant: MoneyVisibilityGrant | null;
  partner: { id: string; displayName: string } | null;
}> {
  const members = await getHouseholdMemberRows(sql, householdId);
  const self = members.find((member) => member.id === viewerId);
  if (!self) {
    throw new ApiError(403, 'not_a_member', 'You are not a member of that household.');
  }
  const partner = members.find((member) => member.id !== viewerId) ?? null;
  return {
    yourGrant: self.moneyVisibilityGrant,
    partnerGrant: partner?.moneyVisibilityGrant ?? null,
    partner: partner
      ? { id: partner.id, displayName: partner.displayName }
      : null,
  };
}

async function findOwnedBudget(
  sql: Database,
  userId: string,
  householdId: string | null,
  visibility: 'PRIVATE' | 'SHARED',
): Promise<{ id: string; currency: string } | null> {
  const [budget] = await sql<{ id: string; currency: string }[]>`
    SELECT id, currency
    FROM budgets
    WHERE
      owner_user_id = ${userId}
      AND visibility = ${visibility}
      AND (
        (${visibility} = 'PRIVATE' AND household_id IS NULL)
        OR (${visibility} = 'SHARED' AND household_id = ${householdId})
      )
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  return budget ?? null;
}

async function ensureSharedBudget(
  sql: Database,
  userId: string,
  householdId: string,
  currency: string,
): Promise<string> {
  const existing = await findOwnedBudget(sql, userId, householdId, 'SHARED');
  if (existing) return existing.id;

  const [created] = await sql<{ id: string }[]>`
    INSERT INTO budgets (
      owner_user_id, household_id, visibility, name, currency, period
    ) VALUES (
      ${userId}, ${householdId}, 'SHARED', 'Shared budget', ${currency}, 'monthly'
    )
    RETURNING id
  `;
  if (!created) {
    throw new ApiError(500, 'budget_create_failed', 'Could not create shared budget.');
  }

  const defaultCategories = [
    'Housing',
    'Food',
    'Transport',
    'Utilities',
    'Health',
    'Fun',
    'Savings',
    'Other',
  ];
  let order = 0;
  for (const name of defaultCategories) {
    await sql`
      INSERT INTO budget_categories (budget_id, name, planned_cents, sort_order)
      VALUES (${created.id}, ${name}, 0, ${order})
    `;
    order += 1;
  }
  return created.id;
}

async function mapCategoryToBudget(
  sql: Database,
  sourceCategoryId: string | null,
  targetBudgetId: string,
): Promise<string | null> {
  if (!sourceCategoryId) return null;
  const [source] = await sql<{ name: string }[]>`
    SELECT name FROM budget_categories WHERE id = ${sourceCategoryId}
  `;
  if (!source) return null;
  const [target] = await sql<{ id: string }[]>`
    SELECT id FROM budget_categories
    WHERE budget_id = ${targetBudgetId} AND lower(name) = lower(${source.name})
    LIMIT 1
  `;
  return target?.id ?? null;
}

export async function moveRecurringToHousehold(
  sql: Database,
  userId: string,
  householdId: string,
  sourceBudgetId: string,
  recurringId: string,
  preferredCurrency: string,
): Promise<RecurringOutgoing> {
  const [sourceBudget] = await sql<
    {
      id: string;
      ownerUserId: string;
      visibility: 'PRIVATE' | 'SHARED';
      householdId: string | null;
      currency: string;
    }[]
  >`
    SELECT id, owner_user_id, visibility, household_id, currency
    FROM budgets
    WHERE id = ${sourceBudgetId}
  `;
  if (!sourceBudget || sourceBudget.ownerUserId !== userId) {
    throw new ApiError(403, 'forbidden', 'Only the bill owner can move it to household.');
  }
  if (sourceBudget.visibility !== 'PRIVATE') {
    throw new ApiError(400, 'already_household', 'This bill is already in the household budget.');
  }

  const [recurring] = await sql<{ id: string }[]>`
    SELECT id
    FROM budget_recurring_outgoings
    WHERE id = ${recurringId} AND budget_id = ${sourceBudgetId}
  `;
  if (!recurring) {
    throw new ApiError(404, 'recurring_not_found', 'Recurring outgoing not found.');
  }

  const existingRow = (await listRecurring(sql, sourceBudgetId)).find(
    (row) => row.id === recurringId,
  );
  if (!existingRow) {
    throw new ApiError(404, 'recurring_not_found', 'Recurring outgoing not found.');
  }

  const targetBudgetId = await ensureSharedBudget(
    sql,
    userId,
    householdId,
    sourceBudget.currency || preferredCurrency,
  );
  const mappedCategoryId = await mapCategoryToBudget(
    sql,
    existingRow.categoryId,
    targetBudgetId,
  );

  const [moved] = await sql<
    {
      id: string;
      budgetId: string;
      categoryId: string | null;
      name: string;
      amountCents: number;
      cadence: RecurringOutgoing['cadence'];
      dayOfMonth: number | null;
      weekday: number | null;
      anchorDate: string | null;
      note: string;
      active: boolean;
      createdAt: string | null;
    }[]
  >`
    UPDATE budget_recurring_outgoings SET
      budget_id = ${targetBudgetId},
      category_id = ${mappedCategoryId},
      updated_at = now()
    WHERE id = ${recurringId}
    RETURNING
      id,
      budget_id,
      category_id,
      name,
      amount_cents,
      cadence,
      day_of_month,
      weekday,
      anchor_date::text AS anchor_date,
      note,
      active,
      created_at::text AS created_at
  `;
  if (!moved) {
    throw new ApiError(500, 'move_failed', 'Could not move recurring outgoing.');
  }
  await sql`UPDATE budgets SET updated_at = now() WHERE id IN (${sourceBudgetId}, ${targetBudgetId})`;
  return {
    id: moved.id,
    budgetId: moved.budgetId,
    categoryId: moved.categoryId,
    name: moved.name,
    amountCents: moved.amountCents,
    cadence: moved.cadence,
    dayOfMonth: moved.dayOfMonth,
    weekday: moved.weekday,
    anchorDate: moved.anchorDate ? moved.anchorDate.slice(0, 10) : null,
    note: moved.note ?? '',
    active: moved.active,
    createdAt: moved.createdAt ? String(moved.createdAt) : null,
  };
}

type BudgetSource = {
  budgetId: string;
  ownerUserId: string;
  ownerDisplayName: string;
  visibility: 'PRIVATE' | 'SHARED';
  readOnly: boolean;
  currency: string;
  payFrequency: PayFrequency | null;
  nextPayDate: string | null;
  typicalPayCents: number | null;
};

async function collectHouseholdBudgetSources(
  sql: Database,
  householdId: string,
  viewerId: string,
  yourGrant: MoneyVisibilityGrant,
  partnerGrant: MoneyVisibilityGrant | null,
  partnerId: string | null,
): Promise<BudgetSource[]> {
  const members = await getHouseholdMemberRows(sql, householdId);
  const sources: BudgetSource[] = [];
  const seenBudgetIds = new Set<string>();

  const addBudget = (row: BudgetSource) => {
    if (seenBudgetIds.has(row.budgetId)) return;
    seenBudgetIds.add(row.budgetId);
    sources.push(row);
  };

  for (const member of members) {
    const sharedBudgets = await sql<
      {
        id: string;
        currency: string;
        payFrequency: PayFrequency | null;
        nextPayDate: string | null;
        typicalPayCents: number | null;
      }[]
    >`
      SELECT
        id, currency, pay_frequency, next_pay_date::text, typical_pay_cents
      FROM budgets
      WHERE
        owner_user_id = ${member.id}
        AND visibility = 'SHARED'
        AND household_id = ${householdId}
    `;
    for (const budget of sharedBudgets) {
      addBudget({
        budgetId: budget.id,
        ownerUserId: member.id,
        ownerDisplayName: member.displayName,
        visibility: 'SHARED',
        readOnly: member.id !== viewerId,
        currency: budget.currency,
        payFrequency: budget.payFrequency,
        nextPayDate: budget.nextPayDate,
        typicalPayCents: budget.typicalPayCents,
      });
    }
  }

  const includePersonalFor = (memberId: string, grant: MoneyVisibilityGrant | null) => {
    if (grant !== 'FULL_VISIBILITY') return;
    return members.find((member) => member.id === memberId);
  };

  for (const member of [
    includePersonalFor(viewerId, yourGrant),
    partnerId ? includePersonalFor(partnerId, partnerGrant) : null,
  ]) {
    if (!member) continue;
    const [privateBudget] = await sql<
      {
        id: string;
        currency: string;
        payFrequency: PayFrequency | null;
        nextPayDate: string | null;
        typicalPayCents: number | null;
      }[]
    >`
      SELECT
        id, currency, pay_frequency, next_pay_date::text, typical_pay_cents
      FROM budgets
      WHERE owner_user_id = ${member.id} AND visibility = 'PRIVATE'
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    if (!privateBudget) continue;
    addBudget({
      budgetId: privateBudget.id,
      ownerUserId: member.id,
      ownerDisplayName: member.displayName,
      visibility: 'PRIVATE',
      readOnly: member.id !== viewerId,
      currency: privateBudget.currency,
      payFrequency: privateBudget.payFrequency,
      nextPayDate: privateBudget.nextPayDate,
      typicalPayCents: privateBudget.typicalPayCents,
    });
  }

  return sources;
}

function dedupeOutgoingItems(items: AttributedOutgoingItem[]): AttributedOutgoingItem[] {
  const byKey = new Map<string, AttributedOutgoingItem>();
  for (const item of items) {
    const key =
      item.recurringId != null
        ? `recurring:${item.recurringId}`
        : item.source === 'entry'
          ? `entry:${item.id}`
          : `other:${item.id}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }
    if (existing.sourceVisibility === 'PRIVATE' && item.sourceVisibility === 'SHARED') {
      byKey.set(key, item);
    }
  }
  return [...byKey.values()];
}

export async function buildHouseholdMoneyLens(
  sql: Database,
  householdId: string,
  viewerId: string,
  year: number,
  month: number,
) {
  const members = await getHouseholdMemberRows(sql, householdId);
  if (members.length < 2) {
    throw new ApiError(
      400,
      'partner_required',
      'Link a partner before viewing the household money lens.',
    );
  }

  const { yourGrant, partnerGrant, partner } = await getVisibilityContext(
    sql,
    householdId,
    viewerId,
  );
  const sources = await collectHouseholdBudgetSources(
    sql,
    householdId,
    viewerId,
    yourGrant,
    partnerGrant,
    partner?.id ?? null,
  );

  const currency =
    sources.find((source) => source.ownerUserId === viewerId)?.currency ??
    sources[0]?.currency ??
    'GBP';

  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDay = daysInMonth(year, month);
  const end = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

  const allRecurring: AttributedRecurringOutgoing[] = [];
  const entryItems: AttributedOutgoingItem[] = [];
  const payDates = new Set<string>();
  let expectedPayCents: number | null = null;

  for (const source of sources) {
    const recurring = await listRecurring(sql, source.budgetId);
    for (const row of recurring) {
      allRecurring.push({
        ...row,
        ownerUserId: source.ownerUserId,
        ownerDisplayName: source.ownerDisplayName,
        readOnly: source.readOnly,
        sourceVisibility: source.visibility,
      });
    }

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
      SELECT id, kind, amount_cents, note, occurred_on::text, category_id
      FROM budget_entries
      WHERE budget_id = ${source.budgetId}
        AND occurred_on >= ${start}::date
        AND occurred_on <= ${end}::date
      ORDER BY occurred_on ASC
    `;

    const categories = await sql<{ id: string; name: string }[]>`
      SELECT id, name FROM budget_categories WHERE budget_id = ${source.budgetId}
    `;
    const categoryNames = new Map(categories.map((row) => [row.id, row.name]));

    for (const entry of entries) {
      entryItems.push({
        id: entry.id,
        source: 'entry',
        kind: entry.kind,
        date: entry.occurredOn,
        amountCents: entry.amountCents,
        title: entry.note || (entry.kind === 'INCOME' ? 'Income' : 'Expense'),
        note: entry.note,
        categoryId: entry.categoryId,
        categoryName: entry.categoryId ? categoryNames.get(entry.categoryId) ?? null : null,
        recurringId: null,
        savingGoalId: null,
        debtId: null,
        paid: false,
        paidAt: null,
        paymentId: null,
        ownerUserId: source.ownerUserId,
        ownerDisplayName: source.ownerDisplayName,
        readOnly: source.readOnly,
        sourceBudgetId: source.budgetId,
        sourceVisibility: source.visibility,
      });
    }

    if (source.payFrequency && source.nextPayDate) {
      const includePay =
        source.ownerUserId === viewerId ||
        (source.ownerUserId === partner?.id && partnerGrant === 'FULL_VISIBILITY');
      if (includePay) {
        const dates = payDatesInMonth(
          year,
          month,
          source.payFrequency,
          source.nextPayDate,
        );
        for (const date of dates) payDates.add(date);
        if (source.typicalPayCents != null) {
          expectedPayCents = (expectedPayCents ?? 0) + source.typicalPayCents;
        }
      }
    }
  }

  const projected = sources.flatMap((source) => {
    const recurring = allRecurring.filter((row) => row.budgetId === source.budgetId);
    return projectRecurringForMonth(year, month, recurring).map((item) => ({
      ...item,
      ownerUserId: source.ownerUserId,
      ownerDisplayName: source.ownerDisplayName,
      readOnly: source.readOnly,
      sourceBudgetId: source.budgetId,
      sourceVisibility: source.visibility,
    }));
  });

  const recurringItems: AttributedOutgoingItem[] = projected.map((item) => ({
    id: item.id,
    source: 'recurring' as const,
    kind: item.kind,
    date: item.date,
    amountCents: item.amountCents,
    title: item.title,
    note: item.note,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    recurringId: item.recurringId,
    savingGoalId: null,
    debtId: null,
    paid: false,
    paidAt: null,
    paymentId: null,
    ownerUserId: item.ownerUserId,
    ownerDisplayName: item.ownerDisplayName,
    readOnly: item.readOnly,
    sourceBudgetId: item.sourceBudgetId,
    sourceVisibility: item.sourceVisibility,
  }));

  const dedupedEntries = dedupeOutgoingItems(entryItems);
  const dedupedRecurring = dedupeOutgoingItems(recurringItems);
  const list = dedupeOutgoingItems([...dedupedEntries, ...dedupedRecurring]).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  const daysMap = new Map<
    string,
    {
      date: string;
      isPayDay: boolean;
      totalCents: number;
      incomeCents: number;
      items: AttributedOutgoingItem[];
    }
  >();
  for (const item of list) {
    const day = daysMap.get(item.date) ?? {
      date: item.date,
      isPayDay: payDates.has(item.date),
      totalCents: 0,
      incomeCents: 0,
      items: [],
    };
    day.items.push(item);
    if (item.kind === 'EXPENSE') day.totalCents += item.amountCents;
    if (item.kind === 'INCOME') day.incomeCents += item.amountCents;
    daysMap.set(item.date, day);
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
  const oneOffCents = expenseCents - recurringCents;

  const recommendations = buildRecommendations({
    currency,
    payFrequency: null,
    typicalPayCents: expectedPayCents,
    payDates: [...payDates],
    list,
    recurring: allRecurring,
  });

  return {
    lens: 'household' as const,
    householdId,
    year,
    month,
    currency,
    yourGrant,
    partnerGrant,
    partner,
    members: members.map((member) => ({
      id: member.id,
      displayName: member.displayName,
      role: member.role,
    })),
    recurring: allRecurring,
    list,
    days: [...daysMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    totals: {
      expenseCents,
      incomeCents,
      recurringCents,
      oneOffCents,
      expectedPayCents,
      deltaCents:
        expectedPayCents != null ? expectedPayCents - expenseCents : null,
    },
    recommendations,
    emptySharedOnly:
      yourGrant === 'SHARED_BILLS_ONLY' &&
      partnerGrant === 'SHARED_BILLS_ONLY' &&
      list.filter((item) => item.sourceVisibility === 'SHARED').length === 0,
  };
}

export function registerHouseholdMoneyRoutes(
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
  app.put(
    '/v1/households/members/me/money-visibility',
    { preHandler: auth.authenticate },
    async (request) => {
      const userId = (request as { authUser: AuthUser }).authUser.id;
      const body = z
        .object({
          grant: z.enum(['SHARED_BILLS_ONLY', 'FULL_VISIBILITY']),
        })
        .parse(request.body);
      const user = await helpers.getUser(sql, userId);
      if (!user.activeHouseholdId) {
        throw new ApiError(400, 'no_active_household', 'Choose a household first.');
      }

      const members = await getHouseholdMemberRows(sql, user.activeHouseholdId);
      if (members.length < 2) {
        throw new ApiError(
          400,
          'partner_required',
          'Link a partner before changing money visibility.',
        );
      }

      await sql`
        UPDATE household_members SET
          money_visibility_grant = ${body.grant}
        WHERE household_id = ${user.activeHouseholdId}
          AND user_id = ${userId}
      `;
      return helpers.getAccountPayload(sql, userId);
    },
  );

  app.get(
    '/v1/households/active/money-lens',
    { preHandler: auth.authenticate },
    async (request) => {
      const userId = (request as { authUser: AuthUser }).authUser.id;
      const user = await helpers.getUser(sql, userId);
      if (!user.activeHouseholdId) {
        throw new ApiError(400, 'no_active_household', 'Choose a household first.');
      }
      const now = new Date();
      const query = z
        .object({
          year: z.coerce.number().int().min(2000).max(2100).default(now.getUTCFullYear()),
          month: z.coerce.number().int().min(1).max(12).default(now.getUTCMonth() + 1),
        })
        .parse(request.query);
      return buildHouseholdMoneyLens(
        sql,
        user.activeHouseholdId,
        userId,
        query.year,
        query.month,
      );
    },
  );

  app.post(
    '/v1/budgets/:id/recurring/:recurringId/move-to-household',
    { preHandler: auth.authenticate },
    async (request, reply) => {
      const userId = (request as { authUser: AuthUser }).authUser.id;
      const params = z
        .object({ id: z.string().uuid(), recurringId: z.string().uuid() })
        .parse(request.params);
      const user = await helpers.getUser(sql, userId);
      if (!user.activeHouseholdId) {
        throw new ApiError(400, 'no_active_household', 'Choose a household first.');
      }
      const moved = await moveRecurringToHousehold(
        sql,
        userId,
        user.activeHouseholdId,
        params.id,
        params.recurringId,
        user.preferredCurrency ?? 'GBP',
      );
      return reply.code(200).send(moved);
    },
  );
}
