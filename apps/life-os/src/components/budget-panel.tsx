"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createBudget,
  getBudget,
  listBudgets,
  type Account,
  type Budget,
} from "../lib/api";
import { DashboardPanel } from "./dashboard-panel";
import { LifeIcon } from "./life-icon";
import { OutgoingsPanel } from "./outgoings-panel";
import { WealthPanel } from "./wealth-panel";

type Props = {
  account: Account;
  onError: (message: string) => void;
  spendCaptureNonce?: number;
};

export function BudgetPanel({
  account,
  onError,
  spendCaptureNonce = 0,
}: Props) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Budget | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [section, setSection] = useState<"overview" | "spending" | "wealth">(
    "overview",
  );
  const canShare = (account.members?.length ?? 0) >= 2;
  const currency = account.user.preferredCurrency || "GBP";

  const reload = useCallback(
    async (preferredId?: string) => {
      await Promise.resolve();
      setLoading(true);
      setLoadError("");
      try {
        const list = await listBudgets();
        setBudgets(list);
        const nextId =
          preferredId && list.some((budget) => budget.id === preferredId)
            ? preferredId
            : (list[0]?.id ?? null);
        setActiveId(nextId);
        if (nextId) setDetail(await getBudget(nextId));
        else setDetail(null);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not load money.";
        setLoadError(message);
        onError(message);
      } finally {
        setLoading(false);
      }
    },
    [onError],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timer);
  }, [reload, onError, account.user.preferredCurrency]);

  useEffect(() => {
    if (spendCaptureNonce > 0) setSection("spending");
  }, [spendCaptureNonce]);

  async function create(visibility: "PRIVATE" | "SHARED") {
    setBusy(true);
    try {
      const created = await createBudget({
        name: visibility === "SHARED" ? "Shared budget" : "Personal budget",
        visibility,
        currency,
      });
      setActiveId(created.id);
      await reload(created.id);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not create budget.");
    } finally {
      setBusy(false);
    }
  }

  async function selectBudget(id: string) {
    setActiveId(id);
    setLoading(true);
    setLoadError("");
    try {
      setDetail(await getBudget(id));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not open this money space.";
      setLoadError(message);
      onError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4 px-1 pb-1">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#617a57]">
            Money
          </p>
          <h2 className="mt-2 font-serif text-3xl leading-tight">
            Your financial rhythm
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-[#6c7771]">
            See what is coming, understand this month, then act where it matters.
          </p>
        </div>
      </div>

      <nav
        className="grid grid-cols-3 rounded-2xl border border-[#dce1dc] bg-white/70 p-1.5 shadow-[0_8px_30px_rgba(28,45,38,0.05)]"
        aria-label="Money sections"
        role="tablist"
      >
        {(["Overview", "Spending", "Wealth"] as const).map((label) => {
          const id = label.toLowerCase() as "overview" | "spending" | "wealth";
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={section === id}
              className={`min-h-10 rounded-xl px-3 text-xs font-bold transition ${
                section === id
                  ? "bg-[#14241f] text-[#f4f5f0] shadow-sm"
                  : "text-[#6c7771] hover:bg-white hover:text-[#14241f]"
              }`}
              onClick={() => setSection(id)}
            >
              {label}
            </button>
          );
        })}
      </nav>

      {budgets.length > 0 ? (
        <article className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dde2dd] bg-white px-4 py-3">
          <label className="flex min-w-[14rem] flex-1 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eef3eb]">
              <LifeIcon
                name={detail?.visibility === "SHARED" ? "household" : "money"}
                size={18}
                color="#617a57"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-[#87918c]">
                Viewing
              </span>
              <select
                className="mt-0.5 w-full bg-transparent text-sm font-bold text-[#14241f] outline-none"
                value={activeId ?? ""}
                disabled={loading}
                aria-label="Money space"
                onChange={(event) => void selectBudget(event.target.value)}
              >
                {budgets.map((budget) => (
                  <option key={budget.id} value={budget.id}>
                    {budget.name} ·{" "}
                    {budget.visibility === "SHARED" ? "Shared" : "Personal"}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#dde2dd] px-3 text-[11px] font-bold disabled:opacity-50"
              onClick={() => void create("PRIVATE")}
            >
              <LifeIcon name="add" size={13} color="currentColor" />
              Personal
            </button>
            {canShare ? (
              <button
                type="button"
                disabled={busy}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#dde2dd] px-3 text-[11px] font-bold disabled:opacity-50"
                onClick={() => void create("SHARED")}
              >
                <LifeIcon name="add" size={13} color="currentColor" />
                Shared
              </button>
            ) : null}
          </div>
        </article>
      ) : null}

      {loading ? (
        <article
          className="rounded-2xl border border-[#dde2dd] bg-white p-5"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="h-3 w-24 animate-pulse rounded bg-[#e7ebe6]" />
          <div className="mt-4 h-8 w-2/3 animate-pulse rounded-lg bg-[#edf0ec]" />
          <div className="mt-3 h-4 w-full animate-pulse rounded bg-[#edf0ec]" />
          <span className="sr-only">Loading money</span>
        </article>
      ) : loadError ? (
        <article
          className="rounded-2xl border border-[#efd4cd] bg-[#fff8f6] p-5"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <LifeIcon name="error" size={20} color="#c9634f" />
            <div>
              <p className="font-semibold">Money could not be loaded</p>
              <p className="mt-1 text-sm text-[#6c7771]">{loadError}</p>
              <button
                type="button"
                className="mt-4 rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-[#f4f5f0]"
                onClick={() => void reload(activeId ?? undefined)}
              >
                Try again
              </button>
            </div>
          </div>
        </article>
      ) : null}

      {!loading && !loadError && section === "overview" && detail ? (
        <DashboardPanel
          budget={detail}
          currency={currency}
          onError={onError}
          onNavigate={setSection}
        />
      ) : null}

      {!loading && !loadError && section === "overview" && !detail ? (
        <article className="relative overflow-hidden rounded-3xl border border-[#d7dfd5] bg-gradient-to-br from-white via-white to-[#eaf1e6] p-6 sm:p-8">
          <div className="max-w-lg">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#14241f]">
              <LifeIcon name="money" size={22} color="#d6f57a" />
            </span>
            <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.16em] text-[#617a57]">
              Your first pulse
            </p>
            <h3 className="mt-2 font-serif text-3xl leading-tight">
              Start with your monthly rhythm
            </h3>
            <p className="mt-3 text-sm leading-6 text-[#6c7771]">
              Create a private money space, then add category plans, regular
              bills, and your payday. Your overview will build from only what you
              record.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#14241f] px-4 text-xs font-bold text-[#f4f5f0] disabled:opacity-50"
                onClick={() => void create("PRIVATE")}
              >
                <LifeIcon name="add" size={15} color="currentColor" />
                Create personal space
              </button>
              {canShare ? (
                <button
                  type="button"
                  disabled={busy}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#cfd8ce] bg-white px-4 text-xs font-bold disabled:opacity-50"
                  onClick={() => void create("SHARED")}
                >
                  <LifeIcon name="household" size={15} color="#617a57" />
                  Create shared space
                </button>
              ) : null}
            </div>
            {!canShare ? (
              <p className="mt-3 text-xs text-[#87918c]">
                Link a partner under You to create a shared space.
              </p>
            ) : null}
          </div>
        </article>
      ) : null}

      {!loading && !loadError && section === "spending" && detail ? (
        <OutgoingsPanel
          budget={detail}
          preferredCurrency={currency}
          onError={onError}
          onChanged={() => void reload(activeId ?? undefined)}
          focusDailyExpense={spendCaptureNonce}
        />
      ) : null}

      {!loading && !loadError && section === "spending" && !detail ? (
        <article className="rounded-2xl border border-[#dde2dd] bg-white p-6 text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[#eef3eb]">
            <LifeIcon name="spending" size={22} color="#617a57" />
          </span>
          <h3 className="mt-4 font-serif text-2xl">Spending needs a money space</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6c7771]">
            Create one to keep outgoings, categories, daily expenses, and pay
            schedules together.
          </p>
          <button
            type="button"
            disabled={busy}
            className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#14241f] px-4 text-xs font-bold text-[#f4f5f0] disabled:opacity-50"
            onClick={() => void create("PRIVATE")}
          >
            <LifeIcon name="add" size={15} color="currentColor" />
            Create personal space
          </button>
        </article>
      ) : null}

      {!loading && !loadError && section === "wealth" ? (
        <WealthPanel
          account={account}
          budgetId={detail?.id ?? null}
          currency={currency}
          canShare={canShare}
          onError={onError}
        />
      ) : null}
    </section>
  );
}
