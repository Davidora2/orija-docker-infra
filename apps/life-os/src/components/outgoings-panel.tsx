"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createRecurringOutgoing,
  currencySymbol,
  formatMoney,
  getMonthOutgoings,
  updateBudget,
  type Budget,
  type MonthOutgoings,
} from "../lib/api";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type Props = {
  budget: Budget;
  preferredCurrency?: string;
  onError: (message: string) => void;
  onChanged: () => void;
};

export function OutgoingsPanel({
  budget,
  preferredCurrency,
  onError,
  onChanged,
}: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [data, setData] = useState<MonthOutgoings | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [payFrequency, setPayFrequency] = useState(budget.payFrequency ?? "monthly");
  const [nextPayDate, setNextPayDate] = useState(budget.nextPayDate ?? "");
  const [typicalPay, setTypicalPay] = useState(
    budget.typicalPayCents != null ? String(budget.typicalPayCents / 100) : "",
  );

  const [recName, setRecName] = useState("");
  const [recAmount, setRecAmount] = useState("");
  const [recDay, setRecDay] = useState("1");
  const [recCadence, setRecCadence] = useState<"weekly" | "monthly" | "yearly">(
    "monthly",
  );
  const [recWeekday, setRecWeekday] = useState("1");

  const displayCurrency =
    preferredCurrency || data?.currency || budget.currency || "GBP";
  const symbol = currencySymbol(displayCurrency);

  useEffect(() => {
    setPayFrequency(budget.payFrequency ?? "monthly");
    setNextPayDate(budget.nextPayDate ?? "");
    setTypicalPay(
      budget.typicalPayCents != null ? String(budget.typicalPayCents / 100) : "",
    );
  }, [budget.id, budget.payFrequency, budget.nextPayDate, budget.typicalPayCents]);

  const load = useCallback(async () => {
    const next = await getMonthOutgoings(budget.id, year, month);
    setData(next);
    if (!selectedDate && next.list[0]) setSelectedDate(next.list[0].date);
  }, [budget.id, year, month, selectedDate]);

  useEffect(() => {
    void load().catch((error) =>
      onError(error instanceof Error ? error.message : "Could not load outgoings."),
    );
  }, [load, onError, budget.currency, preferredCurrency]);

  const selectedDay = useMemo(
    () => data?.days.find((day) => day.date === selectedDate) ?? null,
    [data, selectedDate],
  );

  const firstWeekday = useMemo(() => {
    return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  }, [year, month]);

  function shiftMonth(delta: number) {
    const date = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(date.getUTCFullYear());
    setMonth(date.getUTCMonth() + 1);
    setSelectedDate(null);
  }

  async function savePaySchedule() {
    setBusy(true);
    try {
      const pounds = Number(typicalPay);
      await updateBudget(budget.id, {
        payFrequency,
        nextPayDate: nextPayDate || null,
        typicalPayCents:
          Number.isFinite(pounds) && pounds >= 0 ? Math.round(pounds * 100) : null,
      });
      await load();
      onChanged();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not save pay schedule.");
    } finally {
      setBusy(false);
    }
  }

  async function addRecurring() {
    const pounds = Number(recAmount);
    if (!recName.trim() || !Number.isFinite(pounds) || pounds <= 0) {
      onError("Add a name and positive amount for the recurring outgoing.");
      return;
    }
    setBusy(true);
    try {
      await createRecurringOutgoing(budget.id, {
        name: recName.trim(),
        amountCents: Math.round(pounds * 100),
        cadence: recCadence,
        dayOfMonth: recCadence === "weekly" ? null : Number(recDay),
        weekday: recCadence === "weekly" ? Number(recWeekday) : null,
      });
      setRecName("");
      setRecAmount("");
      await load();
      onChanged();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not add recurring outgoing.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
              Monthly outgoings
            </p>
            <h3 className="font-serif text-2xl">
              {MONTH_NAMES[month - 1]} {year}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl border border-[#dde2dd] px-3 py-2 text-xs font-bold text-[#14241f]"
              onClick={() => shiftMonth(-1)}
            >
              Prev
            </button>
            <button
              type="button"
              className="rounded-xl border border-[#dde2dd] px-3 py-2 text-xs font-bold text-[#14241f]"
              onClick={() => shiftMonth(1)}
            >
              Next
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                view === "calendar"
                  ? "bg-[#14241f] text-[#f4f5f0]"
                  : "border border-[#dde2dd] text-[#14241f]"
              }`}
              onClick={() => setView("calendar")}
            >
              Calendar
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                view === "list"
                  ? "bg-[#14241f] text-[#f4f5f0]"
                  : "border border-[#dde2dd] text-[#14241f]"
              }`}
              onClick={() => setView("list")}
            >
              List
            </button>
          </div>
        </div>
        {data ? (
          <p className="mt-2 text-sm text-[#6c7771]">
            {formatMoney(data.totals.expenseCents, displayCurrency)} out ·{" "}
            {formatMoney(data.totals.recurringCents, displayCurrency)} recurring ·{" "}
            {formatMoney(data.totals.oneOffCents, displayCurrency)} one-off
          </p>
        ) : null}
      </article>

      <article className="rounded-2xl border border-[#dde2dd] bg-white p-5 space-y-3">
        <h4 className="font-semibold">Pay schedule</h4>
        <p className="text-sm text-[#6c7771]">
          Recommendations use your payday rhythm and frequent spends.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <select
            className="rounded-xl border border-[#dde2dd] px-3 py-3"
            value={payFrequency ?? "monthly"}
            onChange={(e) =>
              setPayFrequency(
                e.target.value as "weekly" | "biweekly" | "four_weekly" | "monthly",
              )
            }
          >
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="four_weekly">Every 4 weeks</option>
            <option value="monthly">Monthly</option>
          </select>
          <input
            className="rounded-xl border border-[#dde2dd] px-3 py-3"
            type="date"
            value={nextPayDate}
            onChange={(e) => setNextPayDate(e.target.value)}
          />
          <input
            className="rounded-xl border border-[#dde2dd] px-3 py-3"
            placeholder={`Typical pay (${symbol})`}
            value={typicalPay}
            onChange={(e) => setTypicalPay(e.target.value)}
          />
        </div>
        <button
          type="button"
          disabled={busy}
          className="rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-[#f4f5f0] disabled:opacity-50"
          onClick={() => void savePaySchedule()}
        >
          Save pay schedule
        </button>
      </article>

      {data && view === "calendar" ? (
        <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-[#6c7771]">
            {WEEKDAYS.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstWeekday }).map((_, index) => (
              <div key={`pad-${index}`} />
            ))}
            {data.days.map((day) => {
              const dayNum = Number(day.date.slice(8, 10));
              const active = selectedDate === day.date;
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  className={`min-h-[64px] rounded-xl border p-1.5 text-left ${
                    active
                      ? "border-[#14241f] bg-[#14241f] text-[#f4f5f0]"
                      : day.isPayDay
                        ? "border-[#617a57] bg-[#dbe8d7] text-[#14241f]"
                        : "border-[#dde2dd] bg-[#fbfcfa] text-[#14241f]"
                  }`}
                >
                  <div className="text-[11px] font-bold">{dayNum}</div>
                  {day.totalCents > 0 ? (
                    <div className={`mt-1 text-[10px] ${active ? "text-[#d6f57a]" : "text-[#c9634f]"}`}>
                      {formatMoney(day.totalCents, displayCurrency)}
                    </div>
                  ) : null}
                  {day.isPayDay ? (
                    <div className={`mt-0.5 text-[9px] font-bold ${active ? "text-[#d6f57a]" : "text-[#617a57]"}`}>
                      Pay
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
          {selectedDay ? (
            <div className="mt-4 space-y-2 border-t border-[#dde2dd] pt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#617a57]">
                {selectedDay.date}
                {selectedDay.isPayDay ? " · payday" : ""}
              </p>
              {selectedDay.items.length === 0 ? (
                <p className="text-sm text-[#6c7771]">No outgoings on this day.</p>
              ) : (
                selectedDay.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-xs text-[#6c7771]">
                        {item.source === "recurring" ? "Recurring" : "Logged"}
                        {item.note ? ` · ${item.note}` : ""}
                      </p>
                    </div>
                    <p
                      className={`font-bold ${
                        item.kind === "INCOME" ? "text-[#617a57]" : "text-[#c9634f]"
                      }`}
                    >
                      {item.kind === "INCOME" ? "+" : "-"}
                      {formatMoney(item.amountCents, displayCurrency)}
                    </p>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </article>
      ) : null}

      {data && view === "list" ? (
        <article className="rounded-2xl border border-[#dde2dd] bg-white p-5 space-y-3">
          {data.list.length === 0 ? (
            <p className="text-sm text-[#6c7771]">No outgoings this month yet.</p>
          ) : (
            data.list.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 border-t border-[#dde2dd] pt-3 first:border-0 first:pt-0"
              >
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-xs text-[#6c7771]">
                    {item.date} · {item.source === "recurring" ? "Recurring" : "Logged"}
                  </p>
                </div>
                <p className="font-bold text-[#c9634f]">
                  -{formatMoney(item.amountCents, displayCurrency)}
                </p>
              </div>
            ))
          )}
        </article>
      ) : null}

      <article className="rounded-2xl border border-[#dde2dd] bg-white p-5 space-y-3">
        <h4 className="font-semibold">Add recurring outgoing</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-xl border border-[#dde2dd] px-3 py-3"
            placeholder="Name (e.g. Rent)"
            value={recName}
            onChange={(e) => setRecName(e.target.value)}
          />
          <input
            className="rounded-xl border border-[#dde2dd] px-3 py-3"
            placeholder={`Amount (${symbol})`}
            value={recAmount}
            onChange={(e) => setRecAmount(e.target.value)}
          />
          <select
            className="rounded-xl border border-[#dde2dd] px-3 py-3"
            value={recCadence}
            onChange={(e) =>
              setRecCadence(e.target.value as "weekly" | "monthly" | "yearly")
            }
          >
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="yearly">Yearly</option>
          </select>
          {recCadence === "weekly" ? (
            <select
              className="rounded-xl border border-[#dde2dd] px-3 py-3"
              value={recWeekday}
              onChange={(e) => setRecWeekday(e.target.value)}
            >
              {WEEKDAYS.map((label, index) => (
                <option key={label} value={index}>
                  Every {label}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="rounded-xl border border-[#dde2dd] px-3 py-3"
              type="number"
              min={1}
              max={28}
              value={recDay}
              onChange={(e) => setRecDay(e.target.value)}
              placeholder="Day of month"
            />
          )}
        </div>
        <button
          type="button"
          disabled={busy}
          className="rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-[#f4f5f0] disabled:opacity-50"
          onClick={() => void addRecurring()}
        >
          Add recurring
        </button>
      </article>

      {data ? (
        <article className="rounded-2xl border border-[#dde2dd] bg-white p-5 space-y-3">
          <h4 className="font-serif text-xl">Pay vs bills flags</h4>
          {(data.flags ?? data.recommendations.filter((item) => item.flagged))
            .length === 0 ? (
            <p className="text-sm text-[#6c7771]">
              No timing conflicts flagged for this pay cycle.
            </p>
          ) : (
            (data.flags ?? data.recommendations.filter((item) => item.flagged)).map(
              (item) => (
                <div
                  key={`flag-${item.id}`}
                  className="rounded-xl border border-[#efd4cd] bg-[#fff7f5] p-3"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#c9634f]">
                    Flagged · {item.scenario ?? item.severity}
                  </p>
                  <p className="mt-1 font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm text-[#6c7771]">{item.detail}</p>
                  <p className="mt-2 text-sm font-semibold text-[#14241f]">
                    {item.action}
                  </p>
                </div>
              ),
            )
          )}
        </article>
      ) : null}

      {data ? (
        <article className="rounded-2xl border border-[#dde2dd] bg-white p-5 space-y-3">
          <h4 className="font-serif text-xl">Optimise recommendations</h4>
          {data.recommendations.length === 0 ? (
            <p className="text-sm text-[#6c7771]">
              Looking healthy — keep logging spends for sharper tips.
            </p>
          ) : (
            data.recommendations.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl border p-3 ${
                  item.severity === "high"
                    ? "border-[#efd4cd] bg-[#fff7f5]"
                    : item.severity === "medium"
                      ? "border-[#f2e2c4] bg-[#fff8ec]"
                      : "border-[#dde2dd] bg-[#f7f9f5]"
                }`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#6c7771]">
                  {item.flagged ? "Flagged · " : ""}
                  {item.severity}
                </p>
                <p className="mt-1 font-semibold">{item.title}</p>
                <p className="mt-1 text-sm text-[#6c7771]">{item.detail}</p>
                <p className="mt-2 text-sm font-semibold text-[#14241f]">{item.action}</p>
              </div>
            ))
          )}
        </article>
      ) : null}
    </section>
  );
}
