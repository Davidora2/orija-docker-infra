import type { Database } from './db.js';
import type { Mailer } from './mailer.js';
import {
  daysInMonth,
  intervalDatesInMonth,
  toDateString,
} from './budget-cashflow.js';

export type OutstandingDueItem = {
  sourceType: 'recurring_outgoing' | 'saving_goal' | 'debt';
  sourceId: string;
  budgetId: string | null;
  dueDate: string;
  amountCents: number;
  title: string;
  currency: string;
};

type ReminderUser = {
  id: string;
  email: string;
  displayName: string;
  timezone: string;
};

function todayInTimezone(timezone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return toDateString(now);
  }
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP',
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency || 'GBP'}`;
  }
}

export async function listOutstandingDueOnDate(
  sql: Database,
  userId: string,
  dueDate: string,
): Promise<OutstandingDueItem[]> {
  const due = dueDate.slice(0, 10);
  const year = Number(due.slice(0, 4));
  const month = Number(due.slice(5, 7));
  const day = Number(due.slice(8, 10));
  if (!year || !month || !day) return [];

  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const dim = daysInMonth(year, month);

  const recurring = await sql<
    {
      id: string;
      budgetId: string;
      name: string;
      amountCents: number;
      cadence: 'weekly' | 'biweekly' | 'four_weekly' | 'monthly' | 'yearly';
      dayOfMonth: number | null;
      weekday: number | null;
      anchorDate: string | null;
      currency: string;
    }[]
  >`
    SELECT
      r.id,
      r.budget_id,
      r.name,
      r.amount_cents,
      r.cadence,
      r.day_of_month,
      r.weekday,
      r.anchor_date::text,
      b.currency
    FROM budget_recurring_outgoings r
    INNER JOIN budgets b ON b.id = r.budget_id
    WHERE r.active = true
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

  const items: OutstandingDueItem[] = [];
  for (const row of recurring) {
    let matches = false;
    if (row.cadence === 'weekly' && row.weekday != null) {
      matches = row.weekday === weekday;
    } else if (
      (row.cadence === 'biweekly' || row.cadence === 'four_weekly') &&
      row.anchorDate
    ) {
      const interval = row.cadence === 'biweekly' ? 14 : 28;
      matches = intervalDatesInMonth(
        year,
        month,
        interval,
        row.anchorDate.slice(0, 10),
      ).includes(due);
    } else if (
      (row.cadence === 'monthly' || row.cadence === 'yearly') &&
      row.dayOfMonth != null
    ) {
      matches = Math.min(row.dayOfMonth, dim) === day;
    }
    if (!matches) continue;
    items.push({
      sourceType: 'recurring_outgoing',
      sourceId: row.id,
      budgetId: row.budgetId,
      dueDate: due,
      amountCents: Number(row.amountCents),
      title: row.name,
      currency: row.currency,
    });
  }

  const savings = await sql<
    {
      id: string;
      name: string;
      monthlyContributionCents: number;
      contributionDay: number;
      preferredCurrency: string;
    }[]
  >`
    SELECT
      g.id,
      g.name,
      g.monthly_contribution_cents,
      g.contribution_day,
      COALESCE(u.preferred_currency, 'GBP') AS preferred_currency
    FROM saving_goals g
    INNER JOIN users u ON u.id = g.owner_user_id
    WHERE g.monthly_contribution_cents IS NOT NULL
      AND g.contribution_day IS NOT NULL
      AND LEAST(g.contribution_day, ${dim}) = ${day}
      AND (
        g.owner_user_id = ${userId}
        OR (
          g.visibility = 'SHARED'
          AND EXISTS (
            SELECT 1 FROM household_members hm
            WHERE hm.household_id = g.household_id
              AND hm.user_id = ${userId}
          )
        )
      )
  `;

  for (const row of savings) {
    items.push({
      sourceType: 'saving_goal',
      sourceId: row.id,
      budgetId: null,
      dueDate: due,
      amountCents: Number(row.monthlyContributionCents),
      title: `Savings · ${row.name}`,
      currency: row.preferredCurrency,
    });
  }

  const debts = await sql<
    {
      id: string;
      name: string;
      monthlyPaymentCents: number;
      preferredCurrency: string;
    }[]
  >`
    SELECT
      d.id,
      d.name,
      d.monthly_payment_cents,
      COALESCE(u.preferred_currency, 'GBP') AS preferred_currency
    FROM debts d
    INNER JOIN users u ON u.id = d.owner_user_id
    WHERE d.monthly_payment_cents IS NOT NULL
      AND d.payment_day IS NOT NULL
      AND d.balance_cents > 0
      AND LEAST(d.payment_day, ${dim}) = ${day}
      AND (
        d.owner_user_id = ${userId}
        OR (
          d.visibility = 'SHARED'
          AND EXISTS (
            SELECT 1 FROM household_members hm
            WHERE hm.household_id = d.household_id
              AND hm.user_id = ${userId}
          )
        )
      )
  `;

  for (const row of debts) {
    items.push({
      sourceType: 'debt',
      sourceId: row.id,
      budgetId: null,
      dueDate: due,
      amountCents: Number(row.monthlyPaymentCents),
      title: `Debt · ${row.name}`,
      currency: row.preferredCurrency,
    });
  }

  if (items.length === 0) return [];

  const paid = await sql<
    { sourceType: string; sourceId: string; dueDate: string }[]
  >`
    SELECT source_type, source_id, due_date::text
    FROM payment_occurrences
    WHERE owner_user_id = ${userId}
      AND due_date = ${due}::date
  `;
  const paidKeys = new Set(
    paid.map((row) => `${row.sourceType}:${row.sourceId}:${row.dueDate.slice(0, 10)}`),
  );

  return items.filter(
    (item) =>
      !paidKeys.has(`${item.sourceType}:${item.sourceId}:${item.dueDate}`),
  );
}

export function buildOutstandingReminderEmail(
  displayName: string,
  dueDate: string,
  items: OutstandingDueItem[],
): { subject: string; text: string } {
  const lines = items.map(
    (item) => `• ${item.title} — ${formatMoney(item.amountCents, item.currency)}`,
  );
  const totalByCurrency = new Map<string, number>();
  for (const item of items) {
    totalByCurrency.set(
      item.currency,
      (totalByCurrency.get(item.currency) ?? 0) + item.amountCents,
    );
  }
  const totals = [...totalByCurrency.entries()]
    .map(([currency, cents]) => formatMoney(cents, currency))
    .join(', ');

  return {
    subject: `Life OS reminder: ${items.length} outstanding payment${items.length === 1 ? '' : 's'} due today`,
    text: [
      `Hi ${displayName || 'there'},`,
      '',
      `You have ${items.length} outstanding bill, savings, or debt payment due on ${dueDate}:`,
      '',
      ...lines,
      '',
      `Total outstanding: ${totals}`,
      '',
      'Mark them paid in Life OS when done so reminders stop for today.',
      '',
      '— Life OS',
    ].join('\n'),
  };
}

export async function sendBillRemindersForUser(
  sql: Database,
  mailer: Mailer,
  user: ReminderUser,
  now = new Date(),
): Promise<{ sent: boolean; itemCount: number; dueDate: string }> {
  const dueDate = todayInTimezone(user.timezone, now);
  const [already] = await sql<{ id: string }[]>`
    SELECT id FROM bill_reminder_sends
    WHERE user_id = ${user.id} AND reminder_date = ${dueDate}::date
  `;
  if (already) {
    return { sent: false, itemCount: 0, dueDate };
  }

  const outstanding = await listOutstandingDueOnDate(sql, user.id, dueDate);
  if (outstanding.length === 0) {
    return { sent: false, itemCount: 0, dueDate };
  }

  const message = buildOutstandingReminderEmail(
    user.displayName,
    dueDate,
    outstanding,
  );
  await mailer.send({
    to: user.email,
    subject: message.subject,
    text: message.text,
  });

  await sql`
    INSERT INTO bill_reminder_sends (user_id, reminder_date, item_count)
    VALUES (${user.id}, ${dueDate}::date, ${outstanding.length})
    ON CONFLICT (user_id, reminder_date) DO NOTHING
  `;

  return { sent: true, itemCount: outstanding.length, dueDate };
}

export async function runBillReminderPass(
  sql: Database,
  mailer: Mailer,
  log?: { info: (obj: unknown, msg?: string) => void; error: (obj: unknown, msg?: string) => void },
): Promise<{ usersChecked: number; emailsSent: number }> {
  const users = await sql<ReminderUser[]>`
    SELECT id, email, display_name, timezone
    FROM users
    WHERE email IS NOT NULL AND char_length(email) > 3
  `;

  let emailsSent = 0;
  for (const user of users) {
    try {
      const result = await sendBillRemindersForUser(sql, mailer, user);
      if (result.sent) emailsSent += 1;
    } catch (error) {
      log?.error({ err: error, userId: user.id }, 'bill reminder failed');
    }
  }

  log?.info(
    { usersChecked: users.length, emailsSent },
    'bill reminder pass complete',
  );
  return { usersChecked: users.length, emailsSent };
}

export function startBillReminderScheduler(
  sql: Database,
  mailer: Mailer,
  log: { info: (obj: unknown, msg?: string) => void; error: (obj: unknown, msg?: string) => void },
  options: { intervalMs?: number; enabled?: boolean } = {},
): NodeJS.Timeout | null {
  if (options.enabled === false) return null;
  const intervalMs = options.intervalMs ?? 60 * 60 * 1000;

  const tick = () => {
    void runBillReminderPass(sql, mailer, log).catch((error) => {
      log.error({ err: error }, 'bill reminder scheduler error');
    });
  };

  // Delay first run slightly so boot/migrations settle.
  const startup = setTimeout(tick, 15_000);
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  startup.unref?.();

  log.info({ intervalMs }, 'bill reminder scheduler started');
  return timer;
}
