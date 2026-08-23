"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createBudget,
  formatMoney,
  getBudget,
  getHouseholdMoneyLens,
  listBudgets,
  type Account,
  type Budget,
  type HouseholdMoneyLens,
} from "../lib/api";
import {
  loadLastBudgetId,
  saveLastBudgetId,
} from "../lib/budget-selection";
import {
  partnerVisibilityDiscoveryLine,
  resolveBudgetSelection,
  type BudgetListItem,
} from "@life-os/shared";
import { DashboardPanel } from "./dashboard-panel";
import { FocusHero } from "./focus-hero";
import { LifeIcon } from "./life-icon";
import { OutgoingsPanel } from "./outgoings-panel";
import { WealthPanel } from "./wealth-panel";

type MoneyScope = "personal" | "household";

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
  const [budgets, setBudgets] = useState<BudgetListItem[]>([]);
  const [displayBudgets, setDisplayBudgets] = useState<BudgetListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Budget | null>(null);
  const [householdLens, setHouseholdLens] = useState<HouseholdMoneyLens | null>(
    null,
  );
  const [moneyScope, setMoneyScope] = useState<MoneyScope>("personal");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [section, setSection] = useState<"overview" | "spending" | "wealth">(
    "overview",
  );
  const activeIdRef = useRef<string | null>(null);
  const hasLoadedRef = useRef(false);
  const canShare = (account.members?.length ?? 0) >= 2;
  const currency = account.user.preferredCurrency || "GBP";
  const partner = account.members.find((member) => member.id !== account.user.id);
  const personalBudget = useMemo(
    () =>
      displayBudgets.find(
        (budget) =>
          budget.visibility === "PRIVATE" && budget.ownerUserId === account.user.id,
      ) ?? null,
    [displayBudgets, account.user.id],
  );
  const sharedBudgetId = useMemo(
    () =>
      displayBudgets.find(
        (budget) =>
          budget.visibility === "SHARED" && budget.ownerUserId === account.user.id,
      )?.id ?? null,
    [displayBudgets, account.user.id],
  );
  const visibilityLines = partner
    ? partnerVisibilityDiscoveryLine({
        partnerName: partner.displayName,
        yourGrant: account.moneyVisibilityGrant ?? "SHARED_BILLS_ONLY",
        partnerGrant: account.partnerMoneyVisibilityGrant ?? null,
      })
    : null;

  const reloadPersonal = useCallback(
    async (preferredId?: string) => {
      const list = await listBudgets();
      const { budgets: unique, displayBudgets: visible, selectedId: nextId } =
        resolveBudgetSelection(list, account.user.id, {
          preferredId,
          storedId: loadLastBudgetId(account.user.id),
          currentId: activeIdRef.current,
          profileCurrency: currency,
        });
      setBudgets(unique);
      setDisplayBudgets(visible);
      const personalId =
        visible.find(
          (budget) =>
            budget.visibility === "PRIVATE" &&
            budget.ownerUserId === account.user.id,
        )?.id ?? nextId;
      const selectedPersonalId = personalId ?? nextId;
      if (selectedPersonalId !== activeIdRef.current) {
        setActiveId(selectedPersonalId);
        activeIdRef.current = selectedPersonalId;
      }
      if (selectedPersonalId) {
        saveLastBudgetId(account.user.id, selectedPersonalId);
        setDetail(await getBudget(selectedPersonalId));
      } else {
        setDetail(null);
      }
    },
    [account.user.id, currency],
  );

  const reloadHousehold = useCallback(async () => {
    const now = new Date();
    setHouseholdLens(
      await getHouseholdMoneyLens(now.getFullYear(), now.getMonth() + 1),
    );
  }, []);

  const reload = useCallback(
    async (preferredId?: string) => {
      const isInitialLoad = !hasLoadedRef.current;
      if (isInitialLoad) setLoading(true);
      setLoadError("");
      try {
        await reloadPersonal(preferredId);
        if (canShare) {
          await reloadHousehold();
        } else {
          setHouseholdLens(null);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not load money.";
        setLoadError(message);
        onError(message);
      } finally {
        hasLoadedRef.current = true;
        if (isInitialLoad) setLoading(false);
      }
    },
    [canShare, onError, reloadHousehold, reloadPersonal],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timer);
  }, [reload, account.user.preferredCurrency]);

  useEffect(() => {
    if (spendCaptureNonce > 0) setSection("spending");
  }, [spendCaptureNonce]);

  async function createPersonal() {
    setBusy(true);
    try {
      const created = await createBudget({
        name: "Personal budget",
        visibility: "PRIVATE",
        currency,
      });
      setMoneyScope("personal");
      setActiveId(created.id);
      activeIdRef.current = created.id;
      await reload(created.id);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not create budget.");
    } finally {
      setBusy(false);
    }
  }

  const activePersonalDetail =
    moneyScope === "personal" ? detail : personalBudget ? detail : null;
  const householdWealthBudgetId =
    moneyScope === "household" ? sharedBudgetId : detail?.id ?? null;

  return (
    <section className="space-y-4">
      <FocusHero
        accentDot
        eyebrow="Money"
        meta="Calm cashflow pulse — overview, spending, and wealth in one place."
        title="Your financial rhythm"
      />

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

      {canShare ? (
        <article className="rounded-2xl border border-[#dde2dd] bg-white px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#87918c]">
              Viewing
            </span>
            <div className="grid grid-cols-2 rounded-xl border border-[#dde2dd] p-1">
              {(["personal", "household"] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  disabled={loading}
                  className={`rounded-lg px-4 py-2 text-xs font-bold capitalize ${
                    moneyScope === scope
                      ? "bg-[#14241f] text-[#f4f5f0]"
                      : "text-[#6c7771]"
                  }`}
                  onClick={() => setMoneyScope(scope)}
                >
                  {scope}
                </button>
              ))}
            </div>
          </div>
          {visibilityLines ? (
            <p className="mt-3 text-xs text-[#6c7771]">
              {visibilityLines.yours}{" "}
              <Link
                href="?tab=you&dest=household"
                className="font-bold text-[#617a57] underline"
              >
                Change in Household
              </Link>
              {visibilityLines.partner ? (
                <span className="mt-1 block">{visibilityLines.partner}</span>
              ) : null}
            </p>
          ) : null}
        </article>
      ) : displayBudgets.length > 0 ? (
        <article className="rounded-2xl border border-[#dde2dd] bg-white px-4 py-3">
          <p className="text-sm font-bold text-[#14241f]">Personal</p>
          <p className="text-xs text-[#6c7771]">
            Link a partner under You to unlock the household lens.
          </p>
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

      {!loading && !loadError && section === "overview" && moneyScope === "personal" && detail ? (
        <DashboardPanel
          budget={detail}
          currency={currency}
          onError={onError}
          onNavigate={setSection}
        />
      ) : null}

      {!loading && !loadError && section === "overview" && moneyScope === "household" && householdLens ? (
        <article className="space-y-4 rounded-2xl border border-[#dde2dd] bg-white p-5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#617a57]">
            Household overview
          </p>
          <h3 className="font-serif text-3xl">
            {formatMoney(householdLens.totals.expenseCents, householdLens.currency)}
          </h3>
          <p className="text-sm text-[#6c7771]">
            Combined outgoings this month across shared bills
            {householdLens.partnerGrant === "FULL_VISIBILITY" ||
            householdLens.yourGrant === "FULL_VISIBILITY"
              ? " and granted personal visibility"
              : ""}
            .
          </p>
          {householdLens.emptySharedOnly ? (
            <p className="rounded-xl bg-[#f7f8f5] px-3 py-3 text-sm text-[#6c7771]">
              No household bills yet. Move a bill from Personal, or ask your partner
              to share one.
            </p>
          ) : null}
          <button
            type="button"
            className="rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-[#f4f5f0]"
            onClick={() => setSection("spending")}
          >
            Review household spending
          </button>
        </article>
      ) : null}

      {!loading && !loadError && section === "overview" && !detail && moneyScope === "personal" ? (
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
              Create a private money space, then add category plans, regular bills,
              and your payday.
            </p>
            <button
              type="button"
              disabled={busy}
              className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#14241f] px-4 text-xs font-bold text-[#f4f5f0] disabled:opacity-50"
              onClick={() => void createPersonal()}
            >
              <LifeIcon name="add" size={15} color="currentColor" />
              Create personal space
            </button>
          </div>
        </article>
      ) : null}

      {!loading && !loadError && section === "spending" && moneyScope === "personal" && detail ? (
        <OutgoingsPanel
          budget={detail}
          preferredCurrency={currency}
          onError={onError}
          onChanged={() => void reload(activeId ?? undefined)}
          focusDailyExpense={spendCaptureNonce}
          canMoveToHousehold={canShare && detail.visibility === "PRIVATE"}
          yourGrant={account.moneyVisibilityGrant ?? "SHARED_BILLS_ONLY"}
        />
      ) : null}

      {!loading && !loadError && section === "spending" && moneyScope === "household" && householdLens ? (
        <OutgoingsPanel
          budget={detail ?? undefined}
          preferredCurrency={currency}
          onError={onError}
          onChanged={() => void reload(activeId ?? undefined)}
          householdLens={householdLens}
          viewerId={account.user.id}
        />
      ) : null}

      {!loading && !loadError && section === "spending" && !detail && moneyScope === "personal" ? (
        <article className="rounded-2xl border border-[#dde2dd] bg-white p-6 text-center">
          <h3 className="font-serif text-2xl">Spending needs a money space</h3>
          <button
            type="button"
            disabled={busy}
            className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#14241f] px-4 text-xs font-bold text-[#f4f5f0] disabled:opacity-50"
            onClick={() => void createPersonal()}
          >
            Create personal space
          </button>
        </article>
      ) : null}

      {!loading && !loadError && section === "wealth" ? (
        <WealthPanel
          account={account}
          budgetId={householdWealthBudgetId}
          currency={currency}
          canShare={canShare && moneyScope === "household"}
          onError={onError}
        />
      ) : null}
    </section>
  );
}
