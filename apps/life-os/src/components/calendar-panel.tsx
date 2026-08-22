"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatMoney,
  getCalendar,
  type CalendarEvent,
  type CalendarPayload,
} from "../lib/api";
import {
  calendarEventActionId,
  calendarEventLabel,
  calendarEventProjectId,
} from "../lib/calendar-events";
import { CalendarSyncPanel } from "./calendar-sync-panel";
import {
  DelayedEditorialLoading,
  EditorialState,
} from "./editorial-state";

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftWeek(start: string, delta: number): string {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta * 7);
  return date.toISOString().slice(0, 10);
}

function eventTone(type: CalendarEvent["type"]) {
  if (type === "payment") return "bg-[#f8e4df] text-[#8a3d30]";
  if (type === "payday") return "bg-[#dbe8d7] text-[#2f431e]";
  if (type === "milestone") return "bg-[#fff3e8] text-[#8a5a16]";
  return "bg-[#eef2ea] text-[#14241f]";
}

export function CalendarPanel({
  preferredCurrency,
  onError,
  onCompleteTask,
  onRescheduleTask,
  onOpenTask,
  onOpenProject,
  onOpenMoney,
  onSetPrimaryMove,
  busy = false,
}: {
  preferredCurrency?: string;
  onError: (message: string | null) => void;
  onCompleteTask?: (actionId: string) => Promise<void>;
  onRescheduleTask?: (actionId: string, date: string) => Promise<void>;
  onOpenTask?: (actionId: string) => void;
  onOpenProject?: (projectId: string) => void;
  onOpenMoney?: () => void;
  onSetPrimaryMove?: (actionId: string) => Promise<void>;
  busy?: boolean;
}) {
  const now = useMemo(() => new Date(), []);
  const [view, setView] = useState<"week" | "month">("month");
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [weekStart, setWeekStart] = useState(isoToday());
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([
    "task",
    "payment",
    "payday",
    "milestone",
  ]);
  const [data, setData] = useState<CalendarPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    onError(null);
    try {
      const next = await getCalendar({
        view,
        year,
        month,
        start: weekStart,
        areaIds,
        types,
      });
      setData(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load calendar";
      setLoadError(message);
      onError(message);
    } finally {
      setLoading(false);
    }
  }, [view, year, month, weekStart, areaIds, types, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleArea(id: string) {
    setAreaIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  }

  function toggleType(type: string) {
    setTypes((prev) => {
      if (prev.includes(type)) {
        const next = prev.filter((value) => value !== type);
        return next.length ? next : prev;
      }
      return [...prev, type];
    });
  }

  function shiftMonth(delta: number) {
    const date = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(date.getUTCFullYear());
    setMonth(date.getUTCMonth() + 1);
  }

  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleString(
    "en-GB",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );

  const selectedActionId = selectedEvent
    ? calendarEventActionId(selectedEvent)
    : null;
  const selectedProjectId = selectedEvent
    ? calendarEventProjectId(selectedEvent)
    : null;

  function openEvent(event: CalendarEvent) {
    setSelectedEvent(event);
    setRescheduleDate(event.date);
  }

  async function runAction(work: () => Promise<void>) {
    try {
      await work();
      setSelectedEvent(null);
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not update calendar");
    }
  }

  return (
    <section className="space-y-4">
      <CalendarSyncPanel onError={onError} />

      <article className="space-y-3 rounded-2xl border border-[#dde2dd] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl">Calendar</h2>
            <p className="text-sm text-[#6c7771]">
              Tasks, project deadlines, saving targets, payments, and paydays in one place.
            </p>
          </div>
          <div className="flex gap-2">
            {(["week", "month"] as const).map((id) => (
              <button
                key={id}
                type="button"
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  view === id
                    ? "bg-[#14241f] text-[#d6f57a]"
                    : "border border-[#dde2dd] bg-white"
                }`}
                onClick={() => setView(id)}
              >
                {id === "week" ? "Week" : "Month"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {view === "month" ? (
            <>
              <button
                type="button"
                className="rounded-xl border border-[#dde2dd] px-3 py-2 text-xs font-bold"
                onClick={() => shiftMonth(-1)}
              >
                Prev
              </button>
              <p className="text-sm font-semibold">{monthLabel}</p>
              <button
                type="button"
                className="rounded-xl border border-[#dde2dd] px-3 py-2 text-xs font-bold"
                onClick={() => shiftMonth(1)}
              >
                Next
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="rounded-xl border border-[#dde2dd] px-3 py-2 text-xs font-bold"
                onClick={() => setWeekStart((value) => shiftWeek(value, -1))}
              >
                Prev week
              </button>
              <p className="text-sm font-semibold">
                {data ? `${data.rangeStart} → ${data.rangeEnd}` : "This week"}
              </p>
              <button
                type="button"
                className="rounded-xl border border-[#dde2dd] px-3 py-2 text-xs font-bold"
                onClick={() => setWeekStart((value) => shiftWeek(value, 1))}
              >
                Next week
              </button>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {(["task", "milestone", "payment", "payday"] as const).map((type) => (
            <button
              key={type}
              type="button"
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                types.includes(type)
                  ? "bg-[#14241f] text-[#f4f5f0]"
                  : "bg-[#eef2ea] text-[#6c7771]"
              }`}
              onClick={() => toggleType(type)}
            >
              {type === "task"
                ? "Tasks"
                : type === "milestone"
                  ? "Milestones"
                  : type === "payment"
                    ? "Payments"
                    : "Paydays"}
            </button>
          ))}
        </div>

        {data?.areas.length ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                areaIds.length === 0
                  ? "bg-[#14241f] text-[#f4f5f0]"
                  : "bg-[#eef2ea] text-[#6c7771]"
              }`}
              onClick={() => setAreaIds([])}
            >
              All areas
            </button>
            {data.areas.map((area) => (
              <button
                key={area.id}
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  areaIds.includes(area.id)
                    ? "bg-[#14241f] text-[#f4f5f0]"
                    : "bg-[#eef2ea] text-[#6c7771]"
                }`}
                onClick={() => toggleArea(area.id)}
              >
                {area.title}
              </button>
            ))}
          </div>
        ) : null}

        {data ? (
          <p className="text-xs text-[#6c7771]">
            {data.counts.tasks} tasks · {data.counts.milestones ?? 0} milestones ·{" "}
            {data.counts.payments} payments · {data.counts.paydays} paydays
          </p>
        ) : null}
      </article>

      {loading ? (
        <DelayedEditorialLoading
          title="Laying out your calendar"
          description="Gathering tasks, milestones, payments, and paydays."
        />
      ) : null}

      {!loading && loadError ? (
        <EditorialState
          kind="error"
          title="Calendar could not open"
          description={loadError}
          action={
            <button
              type="button"
              className="rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-white"
              onClick={() => void load()}
            >
              Try again
            </button>
          }
        />
      ) : null}

      {!loading && !loadError && data?.events.length === 0 ? (
        <EditorialState
          kind="empty"
          title="A quiet stretch"
          description="No tasks, deadlines, saving targets, payments, or paydays match these filters."
        />
      ) : null}

      {!loading && !loadError && data && data.events.length > 0 ? (
        <div className="space-y-2">
          {view === "month" ? (
            <div className="hidden grid-cols-7 gap-2 md:grid">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
                <p
                  key={label}
                  className="px-1 text-center text-[11px] font-bold uppercase tracking-wide text-[#6c7771]"
                >
                  {label}
                </p>
              ))}
            </div>
          ) : null}
          <div
            className={`grid gap-2 ${
              view === "month"
                ? "grid-cols-2 sm:grid-cols-4 md:grid-cols-7"
                : "grid-cols-1 sm:grid-cols-2 md:grid-cols-7"
            }`}
          >
            {data.days.map((day) => {
              const inMonth =
                day.date.startsWith(
                  `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-`,
                );
              return (
                <article
                  key={day.date}
                  className={`min-h-[110px] rounded-2xl border p-3 ${
                    inMonth
                      ? "border-[#dde2dd] bg-white"
                      : "border-[#e8ebe6] bg-[#f7f8f5] opacity-70"
                  }`}
                >
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
                    {day.weekday}
                  </p>
                  <p className="text-sm font-semibold">{day.date.slice(8)}</p>
                  <div className="mt-2 space-y-1">
                    {day.events.length === 0 ? (
                      <p className="text-[11px] text-[#9ba49e]">—</p>
                    ) : (
                      day.events.map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          className={`w-full rounded-lg px-2 py-1 text-left text-[11px] leading-snug ${eventTone(event.type)}`}
                          onClick={() => openEvent(event)}
                        >
                          <p className="font-semibold">{event.title}</p>
                          {event.amountCents != null ? (
                            <p>
                              {formatMoney(
                                event.amountCents,
                                preferredCurrency || "GBP",
                              )}
                            </p>
                          ) : null}
                          {event.areaTitle ? (
                            <p className="opacity-80">{event.areaTitle}</p>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      {selectedEvent ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-event-title"
            className="w-full max-w-md rounded-2xl border border-[#dde2dd] bg-white p-5 shadow-lg"
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
              {calendarEventLabel(selectedEvent.type)}
            </p>
            <h3
              id="calendar-event-title"
              className="mt-1 font-serif text-2xl text-[#14241f]"
            >
              {selectedEvent.title}
            </h3>
            <p className="mt-1 text-sm text-[#6c7771]">
              {selectedEvent.date}
              {selectedEvent.areaTitle ? ` · ${selectedEvent.areaTitle}` : ""}
              {selectedEvent.amountCents != null
                ? ` · ${formatMoney(
                    selectedEvent.amountCents,
                    preferredCurrency || "GBP",
                  )}`
                : ""}
            </p>

            {selectedActionId && onRescheduleTask ? (
              <label className="mt-4 block space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
                  Reschedule
                </span>
                <input
                  type="date"
                  className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                  value={rescheduleDate}
                  onChange={(event) => setRescheduleDate(event.target.value)}
                />
              </label>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {selectedActionId && onRescheduleTask ? (
                <button
                  type="button"
                  disabled={busy || !rescheduleDate}
                  className="rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-[#f4f5f0] disabled:opacity-40"
                  onClick={() =>
                    void runAction(() =>
                      onRescheduleTask(selectedActionId, rescheduleDate),
                    )
                  }
                >
                  Save date
                </button>
              ) : null}
              {selectedActionId && onCompleteTask ? (
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-xl border border-[#dde2dd] bg-white px-4 py-2 text-xs font-bold disabled:opacity-40"
                  onClick={() =>
                    void runAction(() => onCompleteTask(selectedActionId))
                  }
                >
                  Mark complete
                </button>
              ) : null}
              {selectedActionId && onOpenTask ? (
                <button
                  type="button"
                  className="rounded-xl border border-[#dde2dd] bg-white px-4 py-2 text-xs font-bold"
                  onClick={() => {
                    onOpenTask(selectedActionId);
                    setSelectedEvent(null);
                  }}
                >
                  Open in Plan
                </button>
              ) : null}
              {selectedProjectId && onOpenProject ? (
                <button
                  type="button"
                  className="rounded-xl border border-[#dde2dd] bg-white px-4 py-2 text-xs font-bold"
                  onClick={() => {
                    onOpenProject(selectedProjectId);
                    setSelectedEvent(null);
                  }}
                >
                  Open project
                </button>
              ) : null}
              {(selectedEvent.type === "payment" ||
                selectedEvent.type === "payday") &&
              onOpenMoney ? (
                <button
                  type="button"
                  className="rounded-xl border border-[#dde2dd] bg-white px-4 py-2 text-xs font-bold"
                  onClick={() => {
                    onOpenMoney();
                    setSelectedEvent(null);
                  }}
                >
                  Open Money
                </button>
              ) : null}
              {selectedActionId && onSetPrimaryMove ? (
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-xl border border-[#b9d4b0] bg-[#eef3ea] px-4 py-2 text-xs font-bold text-[#2f431e] disabled:opacity-40"
                  onClick={() =>
                    void runAction(() => onSetPrimaryMove(selectedActionId))
                  }
                >
                  Set as primary move
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-xs font-bold text-[#6c7771]"
                onClick={() => setSelectedEvent(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
