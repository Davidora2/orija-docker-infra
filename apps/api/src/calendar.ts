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

export type CalendarEvent = {
  id: string;
  type: 'task' | 'payment' | 'payday';
  date: string;
  title: string;
  amountCents: number | null;
  areaId: string | null;
  areaTitle: string | null;
  status: string | null;
  source: string;
  meta: Record<string, unknown>;
};

function startOfWeekMonday(date: Date): Date {
  const day = date.getUTCDay(); // 0 Sun
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(date, offset);
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
    const now = new Date();
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

    const year = query.year ?? now.getUTCFullYear();
    const month = query.month ?? now.getUTCMonth() + 1;
    const typeSet = new Set(
      (query.types ?? 'task,payment,payday')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    );
    const areaFilter = (query.areaIds ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    let rangeStart: string;
    let rangeEnd: string;
    if (query.view === 'week') {
      const anchor = query.start ? parseIso(query.start) : now;
      const monday = startOfWeekMonday(anchor);
      rangeStart = toDateString(monday);
      rangeEnd = toDateString(addDays(monday, 6));
    } else {
      rangeStart = `${year}-${String(month).padStart(2, '0')}-01`;
      rangeEnd = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth(year, month)).padStart(2, '0')}`;
    }

    const events: CalendarEvent[] = [];

    // Areas for filter chips
    const areas = await sql<{ id: string; title: string }[]>`
      SELECT id, title
      FROM life_items
      WHERE owner_user_id = ${userId}
        AND kind = 'PILLAR'
        AND status = 'ACTIVE'
      ORDER BY sort_order ASC, title ASC
    `;

    // Build parent map for area resolution
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
        // Expand weekday labels across the visible range
        if (typeof body.day === 'string' && !body.dueDate && !body.date) {
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
          // Generate paydays across range by walking months touching the range
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
          // Area filter: payments are money — include always unless areas requested
          // and none selected implies all; if areas selected, still show payments
          // (they're cross-area). Only hide when types excludes payment.

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

    const days: {
      date: string;
      weekday: string;
      events: CalendarEvent[];
    }[] = [];
    let cursor = parseIso(rangeStart);
    const end = parseIso(rangeEnd);
    while (cursor <= end) {
      const date = toDateString(cursor);
      days.push({
        date,
        weekday: weekdayName(cursor),
        events: events.filter((event) => event.date === date),
      });
      cursor = addDays(cursor, 1);
    }

    await assertItemAccess(sql, userId);

    return {
      view: query.view,
      rangeStart,
      rangeEnd,
      year,
      month,
      areas,
      filters: {
        areaIds: areaFilter,
        types: [...typeSet],
      },
      days,
      events,
      counts: {
        tasks: events.filter((event) => event.type === 'task').length,
        payments: events.filter((event) => event.type === 'payment').length,
        paydays: events.filter((event) => event.type === 'payday').length,
      },
    };
  });
}

export { ApiError as CalendarApiError };
