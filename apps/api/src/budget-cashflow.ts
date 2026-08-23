import { ApiError } from './errors.js';
import type { Database } from './db.js';

export type PayFrequency = 'weekly' | 'biweekly' | 'four_weekly' | 'monthly';

export type RecurringOutgoing = {
  id: string;
  budgetId: string;
  categoryId: string | null;
  name: string;
  amountCents: number;
  cadence: 'weekly' | 'biweekly' | 'four_weekly' | 'monthly' | 'yearly';
  dayOfMonth: number | null;
  weekday: number | null;
  anchorDate: string | null;
  note: string;
  active: boolean;
};

export type OutgoingItem = {
  id: string;
  source: 'entry' | 'recurring' | 'saving' | 'debt';
  kind: 'INCOME' | 'EXPENSE';
  date: string;
  amountCents: number;
  title: string;
  note: string;
  categoryId: string | null;
  categoryName: string | null;
  recurringId: string | null;
  savingGoalId: string | null;
  debtId: string | null;
  paid: boolean;
  paidAt: string | null;
  paymentId: string | null;
};

export type Recommendation = {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  action: string;
  flagged: boolean;
  scenario:
    | 'bills_before_payday'
    | 'pre_pay_cluster'
    | 'recurring_vs_pay'
    | 'month_vs_pay'
    | 'front_loaded'
    | 'frequent_spend'
    | 'add_recurring'
    | 'other';
};

export function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function toDateString(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function parseDate(value: string): Date {
  const parts = value.split('-').map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(Date.UTC(y, m - 1, d));
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function payDatesInMonth(
  year: number,
  month: number,
  frequency: PayFrequency | null | undefined,
  nextPayDate: string | null | undefined,
): string[] {
  if (!frequency || !nextPayDate) return [];
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month - 1, daysInMonth(year, month)));
  const interval =
    frequency === 'weekly'
      ? 7
      : frequency === 'biweekly'
        ? 14
        : frequency === 'four_weekly'
          ? 28
          : 0;

  const dates: string[] = [];
  let cursor = parseDate(nextPayDate);

  // Walk backward to before month start
  if (interval > 0) {
    while (cursor > start) cursor = addDays(cursor, -interval);
    while (cursor < start) cursor = addDays(cursor, interval);
    while (cursor <= end) {
      dates.push(toDateString(cursor));
      cursor = addDays(cursor, interval);
    }
    return dates;
  }

  // Monthly: same day-of-month as nextPayDate, clamped to month length
  const payDay = Math.min(parseDate(nextPayDate).getUTCDate(), daysInMonth(year, month));
  dates.push(`${year}-${pad(month)}-${pad(payDay)}`);
  return dates;
}

function cadenceLabel(
  cadence: RecurringOutgoing['cadence'],
): string {
  if (cadence === 'biweekly') return 'every 2 weeks';
  if (cadence === 'four_weekly') return 'every 4 weeks';
  return `${cadence} outgoing`;
}

function recurringDisplayNote(
  row: RecurringOutgoing,
  fallback: string,
): string {
  const userNote = row.note?.trim();
  if (!userNote) return fallback;
  return userNote;
}

export function intervalDatesInMonth(
  year: number,
  month: number,
  intervalDays: number,
  anchorDate: string,
): string[] {
  if (intervalDays <= 0 || !anchorDate) return [];
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month - 1, daysInMonth(year, month)));
  const dates: string[] = [];
  let cursor = parseDate(anchorDate);

  while (cursor > start) cursor = addDays(cursor, -intervalDays);
  while (cursor < start) cursor = addDays(cursor, intervalDays);
  while (cursor <= end) {
    dates.push(toDateString(cursor));
    cursor = addDays(cursor, intervalDays);
  }
  return dates;
}

export function projectRecurringForMonth(
  year: number,
  month: number,
  recurring: RecurringOutgoing[],
): OutgoingItem[] {
  const items: OutgoingItem[] = [];
  const dim = daysInMonth(year, month);

  for (const row of recurring.filter((item) => item.active)) {
    if (row.cadence === 'monthly' || row.cadence === 'yearly') {
      if (!row.dayOfMonth) continue;
      const day = Math.min(row.dayOfMonth, dim);
      const date = `${year}-${pad(month)}-${pad(day)}`;
      items.push({
        id: `recurring:${row.id}:${date}`,
        source: 'recurring',
        kind: 'EXPENSE',
        date,
        amountCents: row.amountCents,
        title: row.name,
        note: recurringDisplayNote(row, cadenceLabel(row.cadence)),
        categoryId: row.categoryId,
        categoryName: null,
        recurringId: row.id,
        savingGoalId: null,
        debtId: null,
        paid: false,
        paidAt: null,
        paymentId: null,
      });
      continue;
    }

    if (row.cadence === 'weekly' && row.weekday != null) {
      for (let day = 1; day <= dim; day += 1) {
        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCDay() !== row.weekday) continue;
        const iso = toDateString(date);
        items.push({
          id: `recurring:${row.id}:${iso}`,
          source: 'recurring',
          kind: 'EXPENSE',
          date: iso,
          amountCents: row.amountCents,
          title: row.name,
          note: recurringDisplayNote(row, 'weekly outgoing'),
          categoryId: row.categoryId,
          categoryName: null,
          recurringId: row.id,
          savingGoalId: null,
          debtId: null,
          paid: false,
          paidAt: null,
          paymentId: null,
        });
      }
      continue;
    }

    if (
      (row.cadence === 'biweekly' || row.cadence === 'four_weekly') &&
      row.anchorDate
    ) {
      const interval = row.cadence === 'biweekly' ? 14 : 28;
      const fallback = cadenceLabel(row.cadence);
      for (const iso of intervalDatesInMonth(year, month, interval, row.anchorDate)) {
        items.push({
          id: `recurring:${row.id}:${iso}`,
          source: 'recurring',
          kind: 'EXPENSE',
          date: iso,
          amountCents: row.amountCents,
          title: row.name,
          note: recurringDisplayNote(row, fallback),
          categoryId: row.categoryId,
          categoryName: null,
          recurringId: row.id,
          savingGoalId: null,
          debtId: null,
          paid: false,
          paidAt: null,
          paymentId: null,
        });
      }
    }
  }

  return items;
}

export function buildRecommendations(input: {
  currency: string;
  payFrequency: PayFrequency | null;
  typicalPayCents: number | null;
  payDates: string[];
  list: OutgoingItem[];
  recurring: RecurringOutgoing[];
}): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const money = (cents: number) => formatMoneyAmount(cents, input.currency);
  const expenses = input.list.filter((item) => item.kind === 'EXPENSE');
  const totalExpense = expenses.reduce((sum, item) => sum + item.amountCents, 0);
  const pay = input.typicalPayCents ?? 0;

  if (!input.payFrequency || !input.payDates.length) {
    recommendations.push({
      id: 'set-pay-schedule',
      severity: 'medium',
      title: 'Set your pay schedule',
      detail:
        'Add how often you get paid and your next payday so we can spot cash-flow squeezes before they hit.',
      action: 'Save pay frequency and next payday in this budget.',
      flagged: true,
      scenario: 'other',
    });
  }

  if (input.payDates.length && expenses.length) {
    const firstPay = input.payDates[0]!;
    const beforePay = expenses.filter((item) => item.date < firstPay);
    const beforeTotal = beforePay.reduce((sum, item) => sum + item.amountCents, 0);
    if (beforeTotal > 0 && (pay === 0 || beforeTotal > pay * 0.35)) {
      recommendations.push({
        id: 'bills-before-payday',
        severity: 'high',
        title: 'Heavy outgoings land before payday',
        detail: `${money(beforeTotal)} is due before ${firstPay}. That often forces overdraft or card use.`,
        action:
          'Move flexible bills (subscriptions, gym, insurance) to the day after payday, or ask providers for a later collection date.',
        flagged: true,
        scenario: 'bills_before_payday',
      });
    }

    // Days immediately before each payday
    for (const payDate of input.payDates) {
      const windowStart = toDateString(addDays(parseDate(payDate), -3));
      const cluster = expenses.filter(
        (item) => item.date >= windowStart && item.date < payDate,
      );
      const clusterTotal = cluster.reduce((sum, item) => sum + item.amountCents, 0);
      if (cluster.length >= 2 && clusterTotal > 0) {
        recommendations.push({
          id: `pre-pay-cluster-${payDate}`,
          severity: 'medium',
          title: `Bills cluster in the 3 days before ${payDate}`,
          detail: `${cluster.length} outgoings totaling ${money(clusterTotal)} hit just before pay clears.`,
          action:
            'Shift at least one larger bill to payday or the day after so the account isn’t empty overnight.',
          flagged: true,
          scenario: 'pre_pay_cluster',
        });
        break;
      }
    }
  }

  // Frequent small/medium spends by title or category
  const freqMap = new Map<string, { count: number; total: number; title: string }>();
  for (const item of expenses.filter((row) => row.source === 'entry')) {
    const key = (item.categoryName || item.title || item.note || 'other')
      .toLowerCase()
      .trim();
    const current = freqMap.get(key) ?? { count: 0, total: 0, title: item.categoryName || item.title };
    current.count += 1;
    current.total += item.amountCents;
    freqMap.set(key, current);
  }
  const frequent = [...freqMap.values()]
    .filter((row) => row.count >= 4)
    .sort((a, b) => b.count - a.count)[0];
  if (frequent) {
    recommendations.push({
      id: 'frequent-spend-envelope',
      severity: 'medium',
      title: `${frequent.title} is a frequent spend`,
      detail: `${frequent.count} charges this month totaling ${money(frequent.total)}.`,
      action: input.payFrequency === 'weekly' || input.payFrequency === 'biweekly'
        ? 'Create a per-pay envelope for this category and top it up on payday so the rest of the balance stays untouched.'
        : 'Set a weekly cap for this category and check it every payday weekend.',
      flagged: false,
      scenario: 'frequent_spend',
    });
  }

  const recurringMonthly = input.recurring
    .filter((row) => row.active)
    .reduce((sum, row) => {
      if (row.cadence === 'weekly') return sum + row.amountCents * 4;
      if (row.cadence === 'biweekly') return sum + row.amountCents * 2;
      if (row.cadence === 'four_weekly') return sum + row.amountCents;
      if (row.cadence === 'yearly') return sum + Math.round(row.amountCents / 12);
      return sum + row.amountCents;
    }, 0);

  if (pay > 0 && recurringMonthly > pay * 0.55) {
    recommendations.push({
      id: 'recurring-vs-pay',
      severity: 'high',
      title: 'Recurring bills eat most of a pay cheque',
      detail: `Estimated recurring load ${money(recurringMonthly)} vs typical pay ${money(pay)}.`,
      action:
        'List cancelable subscriptions, renegotiate broadband/mobile, or move one large bill onto a longer cycle.',
      flagged: true,
      scenario: 'recurring_vs_pay',
    });
  } else if (pay > 0 && totalExpense > pay * 0.9) {
    recommendations.push({
      id: 'month-vs-pay',
      severity: 'high',
      title: 'This month’s outgoings nearly match a full pay',
      detail: `${money(totalExpense)} out vs typical ${money(pay)} in.`,
      action:
        'Delay non-essential purchases until after the next payday and park a fixed savings transfer on payday morning.',
      flagged: true,
      scenario: 'month_vs_pay',
    });
  }

  // Spread recommendation: if >60% of expenses fall in first 10 days
  if (expenses.length >= 3) {
    const early = expenses.filter((item) => Number(item.date.slice(8, 10)) <= 10);
    const earlyTotal = early.reduce((sum, item) => sum + item.amountCents, 0);
    if (earlyTotal > totalExpense * 0.6) {
      recommendations.push({
        id: 'front-loaded-month',
        severity: 'low',
        title: 'Outgoings are front-loaded',
        detail: `${Math.round((earlyTotal / Math.max(totalExpense, 1)) * 100)}% of this month’s spend lands in the first 10 days.`,
        action:
          input.payFrequency === 'monthly'
            ? 'If you’re paid late in the month, move flexible bills later so the dry stretch mid-month is shorter.'
            : 'Align bigger bills with a payday week instead of the calendar start of the month.',
        flagged: true,
        scenario: 'front_loaded',
      });
    }
  }

  if (input.recurring.filter((row) => row.active).length === 0) {
    recommendations.push({
      id: 'add-recurring',
      severity: 'low',
      title: 'Track rent and subscriptions as recurring',
      detail:
        'Calendar and list views get much clearer when fixed outgoings are marked recurring instead of retyped each month.',
      action: 'Add rent, council tax, and subscriptions under Recurring outgoings.',
      flagged: false,
      scenario: 'add_recurring',
    });
  }

  // Deduplicate by id, prefer higher severity
  const rank = { high: 0, medium: 1, low: 2 } as const;
  const deduped = recommendations
    .sort((a, b) => rank[a.severity] - rank[b.severity])
    .slice(0, 8);
  return deduped;
}

function formatMoneyAmount(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP',
    }).format(cents / 100);
  } catch {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(cents / 100);
  }
}

export function projectedExpenseCentsForMonth(input: {
  recurring: RecurringOutgoing[];
  year: number;
  month: number;
  savingContributionCents: number;
  debtPaymentCents: number;
}): number {
  const recurringCents = projectRecurringForMonth(
    input.year,
    input.month,
    input.recurring,
  ).reduce((sum, item) => sum + item.amountCents, 0);
  return (
    recurringCents + input.savingContributionCents + input.debtPaymentCents
  );
}

export async function actualExpenseCentsForMonth(
  sql: Database,
  input: {
    budgetId: string;
    userId: string;
    year: number;
    month: number;
    start: string;
    end: string;
  },
): Promise<number> {
  const [entryTotals] = await sql<{ expenseCents: string | number }[]>`
    SELECT COALESCE(SUM(amount_cents), 0) AS expense_cents
    FROM budget_entries
    WHERE budget_id = ${input.budgetId}
      AND kind = 'EXPENSE'
      AND occurred_on >= ${input.start}::date
      AND occurred_on <= ${input.end}::date
  `;
  const [legacyPayments] = await sql<{ totalCents: string | number }[]>`
    SELECT COALESCE(SUM(amount_cents), 0) AS total_cents
    FROM payment_occurrences
    WHERE owner_user_id = ${input.userId}
      AND budget_entry_id IS NULL
      AND paid_at::date >= ${input.start}::date
      AND paid_at::date <= ${input.end}::date
      AND (
        budget_id = ${input.budgetId}
        OR source_type IN ('saving_goal', 'debt')
      )
  `;
  return (
    Number(entryTotals?.expenseCents ?? 0) +
    Number(legacyPayments?.totalCents ?? 0)
  );
}

export async function listRecurring(
  sql: Database,
  budgetId: string,
): Promise<RecurringOutgoing[]> {
  const rows = await sql<RecurringOutgoing[]>`
    SELECT
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
      active
    FROM budget_recurring_outgoings
    WHERE budget_id = ${budgetId}
    ORDER BY active DESC, cadence ASC, name ASC
  `;
  return rows.map((row) => ({
    ...row,
    note: row.note ?? '',
    anchorDate: row.anchorDate ? String(row.anchorDate).slice(0, 10) : null,
  }));
}

export function assertRecurringCadence(body: {
  cadence: 'weekly' | 'biweekly' | 'four_weekly' | 'monthly' | 'yearly';
  dayOfMonth?: number | null;
  weekday?: number | null;
  anchorDate?: string | null;
}) {
  if (body.cadence === 'weekly' && (body.weekday == null || body.weekday < 0 || body.weekday > 6)) {
    throw new ApiError(400, 'weekday_required', 'Weekly outgoings need a weekday (0=Sun … 6=Sat).');
  }
  if (
    (body.cadence === 'biweekly' || body.cadence === 'four_weekly') &&
    (!body.anchorDate || !/^\d{4}-\d{2}-\d{2}$/.test(body.anchorDate))
  ) {
    throw new ApiError(
      400,
      'anchor_date_required',
      'Every 2 / 4 week outgoings need a next due date (YYYY-MM-DD).',
    );
  }
  if (
    (body.cadence === 'monthly' || body.cadence === 'yearly') &&
    (body.dayOfMonth == null || body.dayOfMonth < 1 || body.dayOfMonth > 28)
  ) {
    throw new ApiError(
      400,
      'day_of_month_required',
      'Monthly/yearly outgoings need a day of month between 1 and 28.',
    );
  }
}
