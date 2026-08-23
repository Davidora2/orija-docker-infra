"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatMoney,
  getCashflowSeries,
  getMonthOutgoings,
  type Budget,
  type CashflowSeries,
  type MonthOutgoings,
} from "../lib/api";
import { CapacityRing } from "./capacity-ring";
import { LifeIcon } from "./life-icon";

type Props = {
  budget: Budget;
  currency: string;
  onError: (message: string) => void;
  onNavigate: (section: "spending" | "wealth") => void;
};

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function isoToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00`));
}

export function DashboardPanel({
  budget,
  currency,
  onError,
  onNavigate,
}: Props) {
  const [data, setData] = useState<CashflowSeries | null>(null);
  const [month, setMonth] = useState<MonthOutgoings | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    await Promise.resolve();
    setStatus("loading");
    setLoadError("");
    const now = new Date();
    try {
      const [nextSeries, nextMonth] = await Promise.all([
        getCashflowSeries(budget.id, 6),
        getMonthOutgoings(budget.id, now.getFullYear(), now.getMonth() + 1),
      ]);
      setData(nextSeries);
      setMonth(nextMonth);
      setStatus("ready");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not load money overview.";
      setLoadError(message);
      setStatus("error");
      onError(message);
    }
  }, [budget.id, onError]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const maxValue = useMemo(() => {
    if (!data?.series.length) return 1;
    return Math.max(
      1,
      ...data.series.flatMap((point) => [
        point.incomeCents > 0 ? point.incomeCents : point.expectedIncomeCents,
        point.expenseCents,
        point.savingContributionCents,
      ]),
    );
  }, [data]);

  const chartUsesExpectedIncome = useMemo(
    () =>
      (data?.series ?? []).some(
        (point) => point.incomeCents <= 0 && point.expectedIncomeCents > 0,
      ),
    [data],
  );

  const plannedCents =
    budget.summary?.plannedCents ??
    (budget.categories ?? []).reduce(
      (total, category) => total + category.plannedCents,
      0,
    );
  const monthOutgoingsCents = month?.totals.expenseCents ?? 0;
  const recurringMonthlyCents = month?.totals.recurringCents ?? 0;
  const oneOffCents = month?.totals.dailyExpenseCents ?? month?.totals.oneOffCents ?? 0;
  const savingCents = month?.totals.savingContributionCents ?? 0;
  const debtCents = month?.totals.debtPaymentCents ?? 0;
  const hasCategoryPlan = plannedCents > 0;
  const hasOutgoings = monthOutgoingsCents > 0;
  const recordedIncomeCents = month?.totals.incomeCents ?? 0;
  const expectedPayCents = month?.totals.expectedPayCents ?? null;
  const hasCashflowBasis = expectedPayCents != null || recordedIncomeCents > 0;
  const cashflowInCents = expectedPayCents ?? recordedIncomeCents;
  const cashflowDeltaCents = cashflowInCents - monthOutgoingsCents;
  const topCue =
    month?.recommendations.find((item) => item.flagged) ??
    month?.recommendations[0] ??
    null;
  const today = isoToday();

  const upcoming = useMemo(() => {
    if (!month) return [];
    const bills = month.list
      .filter(
        (item) =>
          item.kind === "EXPENSE" &&
          item.source !== "entry" &&
          item.date >= today,
      )
      .map((item) => ({
        id: item.id,
        date: item.date,
        title: item.title,
        detail: item.paid ? "Paid" : "Scheduled outgoing",
        amountCents: item.amountCents,
        kind: "bill" as const,
      }));
    const paydays = month.paySchedule.payDates
      .filter((date) => date >= today)
      .map((date) => ({
        id: `payday-${date}`,
        date,
        title: "Payday",
        detail:
          month.paySchedule.typicalPayCents != null
            ? "Typical pay"
            : "Payday marker",
        amountCents: month.paySchedule.typicalPayCents,
        kind: "payday" as const,
      }));
    return [...bills, ...paydays]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 4);
  }, [month, today]);

  if (status === "loading") {
    return (
      <section className="space-y-4" aria-live="polite" aria-busy="true">
        <article className="overflow-hidden rounded-3xl border border-[#d8ded8] bg-[#14241f] p-6 text-[#f4f5f0] sm:p-7">
          <div className="h-3 w-28 animate-pulse rounded bg-white/15" />
          <div className="mt-5 h-10 w-3/4 animate-pulse rounded-xl bg-white/10" />
          <div className="mt-3 h-4 w-full max-w-md animate-pulse rounded bg-white/10" />
        </article>
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((item) => (
            <article
              key={item}
              className="h-44 animate-pulse rounded-2xl border border-[#dde2dd] bg-white/70"
            />
          ))}
        </div>
        <span className="sr-only">Loading money overview</span>
      </section>
    );
  }

  if (status === "error") {
    return (
      <article
        className="rounded-2xl border border-[#efd4cd] bg-[#fff8f6] p-5"
        role="alert"
      >
        <div className="flex items-start gap-3">
          <LifeIcon name="error" size={20} color="#c9634f" />
          <div className="min-w-0">
            <h3 className="font-semibold">Money overview is unavailable</h3>
            <p className="mt-1 text-sm text-[#6c7771]">{loadError}</p>
            <button
              type="button"
              className="mt-4 rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-[#f4f5f0]"
              onClick={() => void load()}
            >
              Try again
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <section className="space-y-4">
      <article className="relative overflow-hidden rounded-3xl border border-[#203b31] bg-[#14241f] p-6 text-[#f4f5f0] shadow-[0_20px_60px_rgba(20,36,31,0.16)] sm:p-7">
        <div
          className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#d6f57a]/10 blur-2xl"
          aria-hidden="true"
        />
        <div className="relative max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#d6f57a]">
            {MONTH_SHORT[(month?.month ?? 1) - 1]} {month?.year} pulse
          </p>
          <h3 className="mt-4 font-serif text-3xl leading-tight sm:text-4xl">
            {hasCashflowBasis
              ? `${formatMoney(Math.abs(cashflowDeltaCents), currency)} ${
                  cashflowDeltaCents >= 0 ? "expected to remain" : "more going out"
                }`
              : `${formatMoney(monthOutgoingsCents, currency)} this month`}
          </h3>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#c9d3ce]">
            {expectedPayCents != null
              ? `${formatMoney(expectedPayCents, currency)} expected pay minus ${formatMoney(
                  monthOutgoingsCents,
                  currency,
                )} in scheduled and recorded outgoings.`
              : recordedIncomeCents > 0
                ? `${formatMoney(recordedIncomeCents, currency)} recorded income minus ${formatMoney(
                    monthOutgoingsCents,
                    currency,
                  )} in scheduled and recorded outgoings.`
                : "This is the total of scheduled and recorded outgoings. Add a pay schedule in Spending to see what may remain."}
          </p>
          {topCue ? (
            <div className="mt-5 border-l-2 border-[#d6f57a] pl-3">
              <p className="text-xs font-bold text-white">{topCue.title}</p>
              <p className="mt-1 text-xs leading-5 text-[#aebdb6]">
                {topCue.detail}
              </p>
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#d6f57a] px-4 text-xs font-bold text-[#2f431e]"
              onClick={() => onNavigate("spending")}
            >
              <LifeIcon name="spending" size={16} color="currentColor" />
              Review spending
            </button>
            <button
              type="button"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 text-xs font-bold text-white"
              onClick={() => onNavigate("wealth")}
            >
              <LifeIcon name="wealth" size={16} color="currentColor" />
              Open wealth
            </button>
          </div>
        </div>
      </article>

      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#617a57]">
                Plan vs month total
              </p>
              <h4 className="mt-2 font-serif text-2xl">
                {hasCategoryPlan
                  ? formatMoney(
                      Math.abs(plannedCents - monthOutgoingsCents),
                      currency,
                    )
                  : hasOutgoings
                    ? formatMoney(monthOutgoingsCents, currency)
                    : "No outgoings yet"}
              </h4>
              <p className="mt-1 text-sm text-[#6c7771]">
                {hasCategoryPlan
                  ? `${
                      monthOutgoingsCents <= plannedCents ? "Under" : "Over"
                    } the category plan`
                  : hasOutgoings
                    ? `${formatMoney(recurringMonthlyCents, currency)} from regular bills this month`
                    : "Add recurring bills or category amounts in Spending"}
              </p>
            </div>
            <CapacityRing
              used={
                hasCategoryPlan
                  ? monthOutgoingsCents / 100
                  : recurringMonthlyCents / 100
              }
              capacity={
                hasCategoryPlan
                  ? plannedCents / 100
                  : monthOutgoingsCents / 100
              }
              size={92}
              label={
                hasCategoryPlan
                  ? "Monthly outgoings against category plan"
                  : "Regular bills share of month outgoings"
              }
              colors={{ used: "#617a57", track: "#e8ece7" }}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#edf0ec] pt-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#87918c]">
                Category plan
              </p>
              <p className="mt-1 text-sm font-bold">
                {formatMoney(plannedCents, currency)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#87918c]">
                Month outgoings
              </p>
              <p className="mt-1 text-sm font-bold">
                {formatMoney(monthOutgoingsCents, currency)}
              </p>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-4 text-[#87918c]">
            {hasCategoryPlan
              ? "Compares category targets with all scheduled or recorded outgoings this month."
              : hasOutgoings
                ? `Month outgoings include ${formatMoney(recurringMonthlyCents, currency)} regular bills${
                    oneOffCents > 0
                      ? `, ${formatMoney(oneOffCents, currency)} one-off spending`
                      : ""
                  }${
                    savingCents > 0
                      ? `, ${formatMoney(savingCents, currency)} savings`
                      : ""
                  }${
                    debtCents > 0
                      ? `, ${formatMoney(debtCents, currency)} debt payments`
                      : ""
                  }. Set category amounts in Spending to track against a plan.`
                : "Add recurring bills or category amounts in Spending."}
          </p>
        </article>

        <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#617a57]">
                Coming up
              </p>
              <h4 className="mt-2 font-serif text-2xl">Bills & payday</h4>
            </div>
            <LifeIcon name="calendar" size={24} color="#617a57" />
          </div>
          {upcoming.length > 0 ? (
            <div className="mt-4 space-y-3">
              {upcoming.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 border-t border-[#edf0ec] pt-3 first:border-0 first:pt-0"
                >
                  <div
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[11px] font-bold ${
                      item.kind === "payday"
                        ? "bg-[#dbe8d7] text-[#36572b]"
                        : "bg-[#f7eee8] text-[#9a503e]"
                    }`}
                  >
                    {formatDate(item.date)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-[#87918c]">{item.detail}</p>
                  </div>
                  {item.amountCents != null ? (
                    <p className="shrink-0 text-sm font-bold">
                      {item.kind === "bill" ? "−" : ""}
                      {formatMoney(item.amountCents, currency)}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-[#f7f8f5] p-4">
              <p className="text-sm font-semibold">Nothing else scheduled</p>
              <p className="mt-1 text-xs leading-5 text-[#6c7771]">
                Add recurring bills or a payday in Spending to build this preview.
              </p>
            </div>
          )}
        </article>
      </div>

      <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#617a57]">
              Recent cashflow
            </p>
            <h4 className="mt-2 font-serif text-2xl">Six-month context</h4>
            <p className="mt-1 text-sm text-[#6c7771]">
              {chartUsesExpectedIncome
                ? "Expected pay and total outgoings by month (recorded income when logged)."
                : "Recorded income and total outgoings by month."}
            </p>
          </div>
        </div>
        {data?.series.length ? (
          <BarChart
            series={data.series}
            maxValue={maxValue}
            currency={currency}
            bars={[
              {
                key: "incomeCents",
                fallbackKey: "expectedIncomeCents",
                label: chartUsesExpectedIncome ? "Expected pay" : "Income",
                color: "#617a57",
              },
              { key: "expenseCents", label: "Outgoings", color: "#d88b77" },
            ]}
          />
        ) : (
          <div className="mt-4 rounded-xl bg-[#f7f8f5] p-4">
            <p className="text-sm font-semibold">No cashflow history yet</p>
            <p className="mt-1 text-xs leading-5 text-[#6c7771]">
              Recorded income and outgoings will add month-by-month context here.
            </p>
          </div>
        )}
      </article>
    </section>
  );
}

function BarChart({
  series,
  maxValue,
  currency,
  bars,
}: {
  series: CashflowSeries["series"];
  maxValue: number;
  currency: string;
  bars: {
    key: keyof CashflowSeries["series"][number];
    fallbackKey?: keyof CashflowSeries["series"][number];
    label: string;
    color: string;
  }[];
}) {
  const width = Math.max(320, series.length * 64);
  const height = 180;
  const pad = 24;
  const groupWidth = (width - pad * 2) / Math.max(series.length, 1);
  const barWidth = Math.max(8, (groupWidth - 8) / bars.length);

  const barValue = (
    point: CashflowSeries["series"][number],
    bar: (typeof bars)[number],
  ) => {
    const primary = Number(point[bar.key] ?? 0);
    if (primary > 0 || !bar.fallbackKey) return primary;
    return Number(point[bar.fallbackKey] ?? 0);
  };

  return (
    <div className="mt-4 overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-full h-48">
        {series.map((point, index) => {
          const x0 = pad + index * groupWidth;
          return (
            <g key={point.label}>
              {bars.map((bar, barIndex) => {
                const value = barValue(point, bar);
                const barHeight =
                  maxValue > 0 ? (value / maxValue) * (height - pad * 2) : 0;
                const x = x0 + barIndex * barWidth;
                const y = height - pad - barHeight;
                return (
                  <rect
                    key={bar.label}
                    x={x}
                    y={y}
                    width={barWidth - 2}
                    height={Math.max(barHeight, 0)}
                    fill={bar.color}
                    rx={3}
                  >
                    <title>
                      {bar.label}: {formatMoney(value, currency)}
                    </title>
                  </rect>
                );
              })}
              <text
                x={x0 + groupWidth / 2 - 8}
                y={height - 6}
                fontSize="10"
                fill="#6c7771"
                textAnchor="middle"
              >
                {MONTH_SHORT[point.month - 1]}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#6c7771]">
        {bars.map((bar) => (
          <span key={bar.label} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: bar.color }}
            />
            {bar.label}
          </span>
        ))}
      </div>
    </div>
  );
}
