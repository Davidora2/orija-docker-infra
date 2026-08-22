import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Database } from './db.js';
import {
  addDays,
  daysInMonth,
  payDatesInMonth,
  projectRecurringForMonth,
  toDateString,
  type PayFrequency,
  type RecurringOutgoing,
} from './budget-cashflow.js';
import { listRecurring } from './budget-cashflow.js';
import { ApiError } from './errors.js';
import { projectTargetDate } from './priority-matrix.js';

export type CalendarEvent = {
  id: string;
  type: 'task' | 'payment' | 'payday' | 'milestone';
  date: string;
  title: string;
  amountCents: number | null;
  areaId: string | null;
  areaTitle: string | null;
  status: string | null;
  source: string;
  meta: Record<string, unknown>;
};

function startOfWeekSunday(date: Date): Date {
  const day = date.getUTCDay(); // 0 Sun … 6 Sat — US default week start
  return addDays(date, -day);
}

function parseIso(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1));
}

function weekdayName(date: Date): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()] ?? '';
}

function resolveActionDate(
  year: number,
  month: number,
  body: Record<string, unknown>,
  fallback: string,
): string | null {
  if (
    typeof body.scheduledDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.scheduledDate)
  ) {
    return body.scheduledDate;
  }
  if (typeof body.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) {
    return body.dueDate;
  }
  if (typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return body.date;
  }
  if (typeof body.day === 'string') {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const target = names.indexOf(body.day);
    if (target >= 0) {
      // Map weekday label onto the requested month's first matching day,
      // then all matching days in range are expanded by caller for week view.
      const dim = daysInMonth(year, month);
      for (let day = 1; day <= dim; day += 1) {
        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCDay() === target) return toDateString(date);
      }
    }
  }
  // Use updated_at date as weak fallback only when explicitly asked — skip
  void fallback;
  return null;
}

async function assertItemAccess(sql: Database, userId: string) {
  // items query scoped in SQL
  void userId;
  void sql;
}

export async function loadCalendarEvents(
  sql: Database,
  userId: string,
  options: {
    view?: 'week' | 'month';
    year?: number;
    month?: number;
    start?: string;
    areaIds?: string[];
    types?: string[];
  } = {},
): Promise<{
  rangeStart: string;
  rangeEnd: string;
  year: number;
  month: number;
  events: CalendarEvent[];
}> {
  const now = new Date();
  const view = options.view ?? 'month';
  const year = options.year ?? now.getUTCFullYear();
  const month = options.month ?? now.getUTCMonth() + 1;
  const typeSet = new Set(
    (options.types ?? ['task', 'payment', 'payday', 'milestone']).map((value) =>
      value.trim(),
    ),
  );
  const areaFilter = options.areaIds ?? [];

  let rangeStart: string;
  let rangeEnd: string;
  if (view === 'week') {
    const anchor = options.start ? parseIso(options.start) : now;
    const sunday = startOfWeekSunday(anchor);
    rangeStart = toDateString(sunday);
    rangeEnd = toDateString(addDays(sunday, 6));
  } else {
    const first = parseIso(
      `${year}-${String(month).padStart(2, '0')}-01`,
    );
    const last = parseIso(
      `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth(year, month)).padStart(2, '0')}`,
    );
    // Pad to full weeks so the month grid always starts on Sunday (US default).
    rangeStart = toDateString(startOfWeekSunday(first));
    rangeEnd = toDateString(addDays(startOfWeekSunday(last), 6));
  }

  const events: CalendarEvent[] = [];

  const items = await sql<
    {
      id: string;
      parentId: string | null;
      kind: string;
      title: string;
      status: string;
      body: Record<string, unknown>;
    }[]
  >`
    SELECT id, parent_id, kind, title, status, body
    FROM life_items
    WHERE owner_user_id = ${userId}
      AND kind IN ('PILLAR', 'PROJECT', 'ACTION', 'GOAL')
      AND status NOT IN ('ARCHIVED')
  `;
  const byId = new Map(items.map((item) => [item.id, item]));

  function areaFor(itemId: string | null): { id: string; title: string } | null {
    let current = itemId ? byId.get(itemId) : null;
    const guard = new Set<string>();
    while (current && !guard.has(current.id)) {
      guard.add(current.id);
      if (current.kind === 'PILLAR') return { id: current.id, title: current.title };
      current = current.parentId ? byId.get(current.parentId) : null;
    }
    return null;
  }

  if (typeSet.has('task')) {
    const actions = items.filter(
      (item) => item.kind === 'ACTION' && item.status !== 'DONE' && item.status !== 'CONVERTED',
    );
    for (const action of actions) {
      const area = areaFor(action.id);
      if (areaFilter.length && (!area || !areaFilter.includes(area.id))) continue;

      const body = action.body ?? {};
      if (
        typeof body.day === 'string' &&
        !body.scheduledDate &&
        !body.dueDate &&
        !body.date
      ) {
        const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const target = names.indexOf(body.day);
        if (target >= 0) {
          let cursor = parseIso(rangeStart);
          const end = parseIso(rangeEnd);
          while (cursor <= end) {
            if (cursor.getUTCDay() === target) {
              const date = toDateString(cursor);
              events.push({
                id: `task:${action.id}:${date}`,
                type: 'task',
                date,
                title: action.title,
                amountCents: null,
                areaId: area?.id ?? null,
                areaTitle: area?.title ?? null,
                status: action.status,
                source: 'action',
                meta: { hours: body.hours ?? null, day: body.day },
              });
            }
            cursor = addDays(cursor, 1);
          }
        }
        continue;
      }

      const date = resolveActionDate(year, month, body, rangeStart);
      if (!date || date < rangeStart || date > rangeEnd) continue;
      events.push({
        id: `task:${action.id}`,
        type: 'task',
        date,
        title: action.title,
        amountCents: null,
        areaId: area?.id ?? null,
        areaTitle: area?.title ?? null,
        status: action.status,
        source: 'action',
        meta: { hours: body.hours ?? null },
      });
    }
  }

  if (typeSet.has('milestone')) {
    const projects = items.filter(
      (item) =>
        item.kind === 'PROJECT' &&
        item.status !== 'DONE' &&
        item.status !== 'CONVERTED' &&
        item.status !== 'CANCELLED',
    );
    for (const project of projects) {
      const due = projectTargetDate(project.body ?? {});
      if (!due || due < rangeStart || due > rangeEnd) continue;
      const area = areaFor(project.id);
      if (areaFilter.length && (!area || !areaFilter.includes(area.id))) continue;
      events.push({
        id: `milestone:${project.id}`,
        type: 'milestone',
        date: due,
        title: `Deadline · ${project.title}`,
        amountCents: null,
        areaId: area?.id ?? null,
        areaTitle: area?.title ?? null,
        status: project.status,
        source: 'project',
        meta: { projectId: project.id, targetDate: due },
      });
    }

    const savingGoals = await sql<
      {
        id: string;
        name: string;
        targetCents: number;
        currentCents: number;
        targetDate: string;
      }[]
    >`
      SELECT
        saving_goals.id,
        saving_goals.name,
        saving_goals.target_cents,
        saving_goals.current_cents,
        saving_goals.target_date::text
      FROM saving_goals
      WHERE saving_goals.target_date >= ${rangeStart}::date
        AND saving_goals.target_date <= ${rangeEnd}::date
        AND (
          saving_goals.owner_user_id = ${userId}
          OR (
            saving_goals.visibility = 'SHARED'
            AND EXISTS (
              SELECT 1
              FROM household_members hm
              WHERE hm.household_id = saving_goals.household_id
                AND hm.user_id = ${userId}
            )
          )
        )
    `;

    for (const goal of savingGoals) {
      const date = goal.targetDate.slice(0, 10);
      events.push({
        id: `milestone:saving-goal:${goal.id}`,
        type: 'milestone',
        date,
        title: `Saving target · ${goal.name}`,
        amountCents: Number(goal.targetCents),
        areaId: null,
        areaTitle: null,
        status:
          Number(goal.currentCents) >= Number(goal.targetCents)
            ? 'ACHIEVED'
            : 'ACTIVE',
        source: 'saving_goal',
        meta: {
          savingGoalId: goal.id,
          targetDate: date,
          deepLink: {
            mobile: `lifeos://money/wealth/savings/${encodeURIComponent(goal.id)}`,
            web: `/?tab=money&money=wealth&savingGoalId=${encodeURIComponent(goal.id)}`,
          },
        },
      });
    }
  }

  if (typeSet.has('payment') || typeSet.has('payday')) {
    const budgets = await sql<
      {
        id: string;
        name: string;
        currency: string;
        payFrequency: PayFrequency | null;
        nextPayDate: string | null;
        typicalPayCents: number | null;
      }[]
    >`
      SELECT
        b.id, b.name, b.currency, b.pay_frequency, b.next_pay_date::text, b.typical_pay_cents
      FROM budgets b
      WHERE
        b.owner_user_id = ${userId}
        OR (
          b.visibility = 'SHARED'
          AND EXISTS (
            SELECT 1 FROM household_members hm
            WHERE hm.household_id = b.household_id AND hm.user_id = ${userId}
          )
        )
    `;

    for (const budget of budgets) {
      if (typeSet.has('payday') && budget.payFrequency && budget.nextPayDate) {
        const start = parseIso(rangeStart);
        const end = parseIso(rangeEnd);
        let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
        while (cursor <= end) {
          const y = cursor.getUTCFullYear();
          const m = cursor.getUTCMonth() + 1;
          for (const payDate of payDatesInMonth(
            y,
            m,
            budget.payFrequency,
            budget.nextPayDate,
          )) {
            if (payDate >= rangeStart && payDate <= rangeEnd) {
              events.push({
                id: `payday:${budget.id}:${payDate}`,
                type: 'payday',
                date: payDate,
                title: `Payday · ${budget.name}`,
                amountCents: budget.typicalPayCents,
                areaId: null,
                areaTitle: null,
                status: null,
                source: 'budget',
                meta: { budgetId: budget.id, currency: budget.currency },
              });
            }
          }
          cursor = new Date(Date.UTC(y, m, 1));
        }
      }

      if (typeSet.has('payment')) {
        const recurring = await listRecurring(sql, budget.id);
        const start = parseIso(rangeStart);
        const end = parseIso(rangeEnd);
        let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
        const projected: ReturnType<typeof projectRecurringForMonth> = [];
        while (cursor <= end) {
          const y = cursor.getUTCFullYear();
          const m = cursor.getUTCMonth() + 1;
          projected.push(...projectRecurringForMonth(y, m, recurring as RecurringOutgoing[]));
          cursor = new Date(Date.UTC(y, m, 1));
        }

        for (const item of projected) {
          if (item.date < rangeStart || item.date > rangeEnd) continue;
          events.push({
            id: item.id,
            type: 'payment',
            date: item.date,
            title: item.title,
            amountCents: item.amountCents,
            areaId: null,
            areaTitle: null,
            status: null,
            source: 'recurring',
            meta: { budgetId: budget.id, recurringId: item.recurringId },
          });
        }

        const entries = await sql<
          {
            id: string;
            amountCents: number;
            note: string;
            occurredOn: string;
            kind: string;
          }[]
        >`
          SELECT id, amount_cents, note, occurred_on::text, kind
          FROM budget_entries
          WHERE budget_id = ${budget.id}
            AND kind = 'EXPENSE'
            AND occurred_on >= ${rangeStart}::date
            AND occurred_on <= ${rangeEnd}::date
        `;
        for (const entry of entries) {
          const date = entry.occurredOn.slice(0, 10);
          events.push({
            id: `entry:${entry.id}`,
            type: 'payment',
            date,
            title: entry.note || 'Expense',
            amountCents: Number(entry.amountCents),
            areaId: null,
            areaTitle: null,
            status: null,
            source: 'entry',
            meta: { budgetId: budget.id },
          });
        }
      }
    }
  }

  events.sort((a, b) =>
    a.date === b.date ? a.title.localeCompare(b.title) : a.date.localeCompare(b.date),
  );

  return { rangeStart, rangeEnd, year, month, events };
}

export function registerCalendarRoutes(
  app: FastifyInstance,
  sql: Database,
  auth: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authenticate: any;
  },
): void {
  app.get('/v1/calendar', { preHandler: auth.authenticate }, async (request) => {
    const userId = (request as { authUser: { id: string } }).authUser.id;
    const query = z
      .object({
        view: z.enum(['week', 'month']).default('month'),
        year: z.coerce.number().int().min(2000).max(2100).optional(),
        month: z.coerce.number().int().min(1).max(12).optional(),
        start: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        areaIds: z.string().optional(),
        types: z.string().optional(),
      })
      .parse(request.query);

    const typeList = (query.types ?? 'task,payment,payday,milestone')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const areaFilter = (query.areaIds ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    const areas = await sql<{ id: string; title: string }[]>`
      SELECT id, title
      FROM life_items
      WHERE owner_user_id = ${userId}
        AND kind = 'PILLAR'
        AND status = 'ACTIVE'
      ORDER BY sort_order ASC, title ASC
    `;

    const loaded = await loadCalendarEvents(sql, userId, {
      view: query.view,
      year: query.year,
      month: query.month,
      start: query.start,
      areaIds: areaFilter,
      types: typeList,
    });

    const days: {
      date: string;
      weekday: string;
      events: CalendarEvent[];
    }[] = [];
    let cursor = parseIso(loaded.rangeStart);
    const end = parseIso(loaded.rangeEnd);
    while (cursor <= end) {
      const date = toDateString(cursor);
      days.push({
        date,
        weekday: weekdayName(cursor),
        events: loaded.events.filter((event) => event.date === date),
      });
      cursor = addDays(cursor, 1);
    }

    await assertItemAccess(sql, userId);

    return {
      view: query.view,
      rangeStart: loaded.rangeStart,
      rangeEnd: loaded.rangeEnd,
      year: loaded.year,
      month: loaded.month,
      areas,
      filters: {
        areaIds: areaFilter,
        types: typeList,
      },
      days,
      events: loaded.events,
      counts: {
        tasks: loaded.events.filter((event) => event.type === 'task').length,
        payments: loaded.events.filter((event) => event.type === 'payment').length,
        paydays: loaded.events.filter((event) => event.type === 'payday').length,
        milestones: loaded.events.filter((event) => event.type === 'milestone')
          .length,
      },
    };
  });
}

export { ApiError as CalendarApiError };
