"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatMoney,
  getCashflowSeries,
  type CashflowSeries,
} from "../lib/api";

type Props = {
  budgetId: string;
  currency: string;
  onError: (message: string) => void;
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

export function DashboardPanel({ budgetId, currency, onError }: Props) {
  const [data, setData] = useState<CashflowSeries | null>(null);
  const [months, setMonths] = useState(6);

  const load = useCallback(async () => {
    const next = await getCashflowSeries(budgetId, months);
    setData(next);
  }, [budgetId, months]);

  useEffect(() => {
    void load().catch((error) =>
      onError(error instanceof Error ? error.message : "Could not load dashboard."),
    );
  }, [load, onError]);

  const maxValue = useMemo(() => {
    if (!data?.series.length) return 1;
    return Math.max(
      1,
      ...data.series.flatMap((point) => [
        point.incomeCents,
        point.expenseCents,
        point.savingContributionCents,
      ]),
    );
  }, [data]);

  return (
    <section className="space-y-4">
      <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-serif text-2xl">Monthly dashboard</h3>
            <p className="mt-1 text-sm text-[#6c7771]">
              Income, total outgoings, and planned savings contributions over time.
            </p>
          </div>
          <select
            className="rounded-xl border border-[#dde2dd] px-3 py-2 text-sm"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
          >
            <option value={3}>3 months</option>
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
          </select>
        </div>
      </article>

      {data ? (
        <>
          <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
              Income vs expenses
            </p>
            <BarChart
              series={data.series}
              maxValue={maxValue}
              currency={currency}
              bars={[
                { key: "incomeCents", label: "Income", color: "#617a57" },
                { key: "expenseCents", label: "Expenses", color: "#c9634f" },
              ]}
            />
          </article>

          <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
              Savings contributions (planned monthly)
            </p>
            <BarChart
              series={data.series}
              maxValue={maxValue}
              currency={currency}
              bars={[
                {
                  key: "savingContributionCents",
                  label: "Savings",
                  color: "#14241f",
                },
              ]}
            />
          </article>

          <article className="rounded-2xl border border-[#dde2dd] bg-white p-5 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
              Month by month
            </p>
            {data.series.map((point) => (
              <div
                key={point.label}
                className="flex flex-wrap items-center justify-between gap-2 border-t border-[#dde2dd] pt-2 text-sm first:border-0 first:pt-0"
              >
                <p className="font-semibold">
                  {MONTH_SHORT[point.month - 1]} {point.year}
                </p>
                <p className="text-[#6c7771]">
                  In {formatMoney(point.incomeCents, currency)} · Out{" "}
                  {formatMoney(point.expenseCents, currency)} · Save{" "}
                  {formatMoney(point.savingContributionCents, currency)} · Net{" "}
                  <span
                    className={
                      point.netCents >= 0 ? "text-[#617a57]" : "text-[#c9634f]"
                    }
                  >
                    {formatMoney(point.netCents, currency)}
                  </span>
                </p>
              </div>
            ))}
          </article>
        </>
      ) : (
        <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
          <p className="text-sm text-[#6c7771]">Loading dashboard…</p>
        </article>
      )}
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
  bars: { key: keyof CashflowSeries["series"][number]; label: string; color: string }[];
}) {
  const width = Math.max(320, series.length * 64);
  const height = 180;
  const pad = 24;
  const groupWidth = (width - pad * 2) / Math.max(series.length, 1);
  const barWidth = Math.max(8, (groupWidth - 8) / bars.length);

  return (
    <div className="mt-4 overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-full h-48">
        {series.map((point, index) => {
          const x0 = pad + index * groupWidth;
          return (
            <g key={point.label}>
              {bars.map((bar, barIndex) => {
                const value = Number(point[bar.key] ?? 0);
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
