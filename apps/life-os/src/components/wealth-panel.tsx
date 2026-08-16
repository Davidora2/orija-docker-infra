"use client";

import { useCallback, useEffect, useState } from "react";
import {
  accrueDebtInterest,
  createDebt,
  createDraftExpense,
  createInvestment,
  createSavingGoal,
  deleteDebt,
  deleteDraftExpense,
  deleteInvestment,
  deleteSavingGoal,
  formatMoney,
  getDraftImpact,
  getNetWorth,
  getWealthMeta,
  listDebts,
  listDraftExpenses,
  listInvestments,
  listSavingGoals,
  updateDebt,
  updateInvestment,
  updateSavingGoal,
  type Account,
  type Debt,
  type DraftExpense,
  type DraftImpact,
  type InvestmentAccount,
  type NetWorth,
  type SavingGoal,
} from "../lib/api";

type Props = {
  account: Account;
  budgetId: string | null;
  currency: string;
  canShare: boolean;
  onError: (message: string) => void;
};

function progress(current: number, target: number) {
  if (target <= 0) return current > 0 ? 100 : 0;
  return Math.min(100, Math.round((current / target) * 100));
}

export function WealthPanel({
  account,
  budgetId,
  currency,
  canShare,
  onError,
}: Props) {
  const [savings, setSavings] = useState<SavingGoal[]>([]);
  const [investments, setInvestments] = useState<InvestmentAccount[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [netWorth, setNetWorth] = useState<NetWorth | null>(null);
  const [drafts, setDrafts] = useState<DraftExpense[]>([]);
  const [impact, setImpact] = useState<DraftImpact | null>(null);
  const [meta, setMeta] = useState<{
    savingCategories: { id: string; label: string }[];
    investmentTypes: { id: string; label: string }[];
    debtTypes: { id: string; label: string }[];
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const [goalName, setGoalName] = useState("");
  const [goalCategory, setGoalCategory] =
    useState<SavingGoal["category"]>("emergency");
  const [goalCustom, setGoalCustom] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalCurrent, setGoalCurrent] = useState("");
  const [goalShared, setGoalShared] = useState(false);
  const [goalMonthly, setGoalMonthly] = useState("");
  const [goalDay, setGoalDay] = useState("1");

  const [invName, setInvName] = useState("");
  const [invType, setInvType] =
    useState<InvestmentAccount["accountType"]>("tfsa");
  const [invCustom, setInvCustom] = useState("");
  const [invGoal, setInvGoal] = useState("");
  const [invCurrent, setInvCurrent] = useState("");
  const [invShared, setInvShared] = useState(false);

  const [draftName, setDraftName] = useState("");
  const [draftAmount, setDraftAmount] = useState("");

  const [debtName, setDebtName] = useState("");
  const [debtType, setDebtType] = useState<Debt["debtType"]>("credit_card");
  const [debtCustom, setDebtCustom] = useState("");
  const [debtBalance, setDebtBalance] = useState("");
  const [debtApr, setDebtApr] = useState("");
  const [debtPayment, setDebtPayment] = useState("");
  const [debtDay, setDebtDay] = useState("1");
  const [debtNote, setDebtNote] = useState("");
  const [debtShared, setDebtShared] = useState(false);

  const money = (cents: number) =>
    formatMoney(cents, account.user.preferredCurrency || currency);

  const reload = useCallback(async () => {
    const [s, i, d, n, m] = await Promise.all([
      listSavingGoals(),
      listInvestments(),
      listDebts(),
      getNetWorth(),
      getWealthMeta(),
    ]);
    setSavings(s);
    setInvestments(i);
    setDebts(d);
    setNetWorth(n);
    setMeta(m);
    if (budgetId) {
      const [d, imp] = await Promise.all([
        listDraftExpenses(budgetId),
        getDraftImpact(budgetId),
      ]);
      setDrafts(d);
      setImpact(imp);
    } else {
      setDrafts([]);
      setImpact(null);
    }
  }, [budgetId]);

  useEffect(() => {
    void reload().catch((err) =>
      onError(err instanceof Error ? err.message : "Could not load wealth"),
    );
  }, [reload, onError]);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    try {
      await work();
      await reload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      {netWorth ? (
        <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
            Net worth
          </p>
          <h2 className="mt-2 font-serif text-3xl">
            {money(netWorth.totalVisibleCents)}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-[#eef2ea] p-3">
              <p className="text-xs font-bold text-[#617a57]">Personal</p>
              <p className="font-serif text-xl">
                {money(netWorth.personal.netWorthCents)}
              </p>
              <p className="mt-1 text-xs text-[#6c7771]">
                Savings {money(netWorth.personal.savingsCents)} · Investments{" "}
                {money(netWorth.personal.investmentsCents)}
                {netWorth.personal.debtsCents
                  ? ` · Debts ${money(netWorth.personal.debtsCents)}`
                  : ""}
              </p>
            </div>
            <div className="rounded-xl bg-[#eef2ea] p-3">
              <p className="text-xs font-bold text-[#617a57]">Household</p>
              <p className="font-serif text-xl">
                {money(netWorth.household.netWorthCents)}
              </p>
              <p className="mt-1 text-xs text-[#6c7771]">
                Shared savings {money(netWorth.household.savingsCents)} · Shared
                investments {money(netWorth.household.investmentsCents)}
              </p>
            </div>
          </div>
        </article>
      ) : null}

      <article className="space-y-3 rounded-2xl border border-[#dde2dd] bg-white p-5">
        <h3 className="font-serif text-2xl">Saving goals</h3>
        <p className="text-sm text-[#6c7771]">
          Emergency, 6-month salary, holiday, house deposit — or add your own.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className="rounded-xl border border-[#dde2dd] px-3 py-2"
            placeholder="Goal name"
            value={goalName}
            onChange={(e) => setGoalName(e.target.value)}
          />
          <select
            className="rounded-xl border border-[#dde2dd] px-3 py-2"
            value={goalCategory}
            onChange={(e) =>
              setGoalCategory(e.target.value as SavingGoal["category"])
            }
          >
            {(meta?.savingCategories ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          {goalCategory === "custom" ? (
            <input
              className="rounded-xl border border-[#dde2dd] px-3 py-2"
              placeholder="Custom category label"
              value={goalCustom}
              onChange={(e) => setGoalCustom(e.target.value)}
            />
          ) : null}
          <input
            className="rounded-xl border border-[#dde2dd] px-3 py-2"
            placeholder="Target amount"
            value={goalTarget}
            onChange={(e) => setGoalTarget(e.target.value)}
          />
          <input
            className="rounded-xl border border-[#dde2dd] px-3 py-2"
            placeholder="Current amount"
            value={goalCurrent}
            onChange={(e) => setGoalCurrent(e.target.value)}
          />
          <input
            className="rounded-xl border border-[#dde2dd] px-3 py-2"
            placeholder="Monthly contribution (optional)"
            value={goalMonthly}
            onChange={(e) => setGoalMonthly(e.target.value)}
          />
          <input
            className="rounded-xl border border-[#dde2dd] px-3 py-2"
            type="number"
            min={1}
            max={28}
            placeholder="Contribution day"
            value={goalDay}
            onChange={(e) => setGoalDay(e.target.value)}
          />
        </div>
        {canShare ? (
          <label className="flex items-center gap-2 text-xs font-bold">
            <input
              type="checkbox"
              checked={goalShared}
              onChange={(e) => setGoalShared(e.target.checked)}
            />
            Share with household
          </label>
        ) : null}
        <button
          type="button"
          disabled={busy}
          className="rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-[#f4f5f0] disabled:opacity-50"
          onClick={() =>
            void run(async () => {
              if (!goalName.trim()) throw new Error("Name the saving goal.");
              const monthly = Number(goalMonthly);
              const hasMonthly = goalMonthly.trim() !== "" && Number.isFinite(monthly) && monthly > 0;
              await createSavingGoal({
                name: goalName.trim(),
                category: goalCategory,
                customLabel:
                  goalCategory === "custom" ? goalCustom.trim() : undefined,
                targetCents: Math.round(Number(goalTarget || 0) * 100),
                currentCents: Math.round(Number(goalCurrent || 0) * 100),
                visibility: goalShared ? "SHARED" : "PRIVATE",
                monthlyContributionCents: hasMonthly
                  ? Math.round(monthly * 100)
                  : null,
                contributionDay: hasMonthly ? Number(goalDay || 1) : null,
              });
              setGoalName("");
              setGoalTarget("");
              setGoalCurrent("");
              setGoalCustom("");
              setGoalMonthly("");
            })
          }
        >
          Add saving goal
        </button>
        {savings.map((goal) => (
          <div
            key={goal.id}
            className="border-t border-[#dde2dd] pt-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{goal.name}</p>
                <p className="text-xs text-[#6c7771]">
                  {goal.customLabel ??
                    meta?.savingCategories.find((c) => c.id === goal.category)
                      ?.label ??
                    goal.category}
                  {goal.visibility === "SHARED" ? " · Shared" : ""}
                </p>
              </div>
              <button
                type="button"
                className="text-xs font-bold text-[#c9634f]"
                disabled={busy}
                onClick={() => void run(async () => deleteSavingGoal(goal.id))}
              >
                Remove
              </button>
            </div>
            <p className="mt-1 text-sm">
              {money(goal.currentCents)} / {money(goal.targetCents)} (
              {progress(goal.currentCents, goal.targetCents)}%)
            </p>
            {goal.monthlyContributionCents ? (
              <p className="mt-1 text-xs text-[#6c7771]">
                Monthly {money(goal.monthlyContributionCents)} on day{" "}
                {goal.contributionDay} · tracked in Outgoings with email reminders
              </p>
            ) : null}
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eef2ea]">
              <div
                className="h-full bg-[#617a57]"
                style={{
                  width: `${progress(goal.currentCents, goal.targetCents)}%`,
                }}
              />
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="rounded-xl border border-[#dde2dd] px-3 py-1 text-xs font-bold"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await updateSavingGoal(goal.id, {
                      currentCents: goal.currentCents + 10000,
                    });
                  })
                }
              >
                +100
              </button>
            </div>
          </div>
        ))}
      </article>

      <article className="space-y-3 rounded-2xl border border-[#dde2dd] bg-white p-5">
        <h3 className="font-serif text-2xl">Investments</h3>
        <p className="text-sm text-[#6c7771]">
          Track FHSA, TFSA, ISA, and other portfolios — goal vs current value.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className="rounded-xl border border-[#dde2dd] px-3 py-2"
            placeholder="Portfolio name"
            value={invName}
            onChange={(e) => setInvName(e.target.value)}
          />
          <select
            className="rounded-xl border border-[#dde2dd] px-3 py-2"
            value={invType}
            onChange={(e) =>
              setInvType(e.target.value as InvestmentAccount["accountType"])
            }
          >
            {(meta?.investmentTypes ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          {invType === "other" ? (
            <input
              className="rounded-xl border border-[#dde2dd] px-3 py-2"
              placeholder="Custom portfolio type"
              value={invCustom}
              onChange={(e) => setInvCustom(e.target.value)}
            />
          ) : null}
          <input
            className="rounded-xl border border-[#dde2dd] px-3 py-2"
            placeholder="Goal value"
            value={invGoal}
            onChange={(e) => setInvGoal(e.target.value)}
          />
          <input
            className="rounded-xl border border-[#dde2dd] px-3 py-2"
            placeholder="Current value"
            value={invCurrent}
            onChange={(e) => setInvCurrent(e.target.value)}
          />
        </div>
        {canShare ? (
          <label className="flex items-center gap-2 text-xs font-bold">
            <input
              type="checkbox"
              checked={invShared}
              onChange={(e) => setInvShared(e.target.checked)}
            />
            Share with household
          </label>
        ) : null}
        <button
          type="button"
          disabled={busy}
          className="rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-[#f4f5f0] disabled:opacity-50"
          onClick={() =>
            void run(async () => {
              if (!invName.trim()) throw new Error("Name the portfolio.");
              await createInvestment({
                name: invName.trim(),
                accountType: invType,
                customLabel: invType === "other" ? invCustom.trim() : undefined,
                goalCents: Math.round(Number(invGoal || 0) * 100),
                currentCents: Math.round(Number(invCurrent || 0) * 100),
                visibility: invShared ? "SHARED" : "PRIVATE",
              });
              setInvName("");
              setInvGoal("");
              setInvCurrent("");
              setInvCustom("");
            })
          }
        >
          Add portfolio
        </button>
        {investments.map((item) => (
          <div key={item.id} className="border-t border-[#dde2dd] pt-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-xs text-[#6c7771]">
                  {item.customLabel ??
                    meta?.investmentTypes.find((t) => t.id === item.accountType)
                      ?.label ??
                    item.accountType}
                  {item.visibility === "SHARED" ? " · Shared" : ""}
                </p>
              </div>
              <button
                type="button"
                className="text-xs font-bold text-[#c9634f]"
                disabled={busy}
                onClick={() => void run(async () => deleteInvestment(item.id))}
              >
                Remove
              </button>
            </div>
            <p className="mt-1 text-sm">
              Current {money(item.currentCents)} · Goal {money(item.goalCents)}{" "}
              ({progress(item.currentCents, item.goalCents)}%)
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eef2ea]">
              <div
                className="h-full bg-[#14241f]"
                style={{
                  width: `${progress(item.currentCents, item.goalCents)}%`,
                }}
              />
            </div>
            <button
              type="button"
              className="mt-2 rounded-xl border border-[#dde2dd] px-3 py-1 text-xs font-bold"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await updateInvestment(item.id, {
                    currentCents: item.currentCents + 25000,
                  });
                })
              }
            >
              +250 current
            </button>
          </div>
        ))}
      </article>

      <article className="rounded-2xl border border-[#dde2dd] bg-white p-5 space-y-3">
        <h3 className="font-serif text-2xl">Debts</h3>
        <p className="text-sm text-[#6c7771]">
          Track balance, interest rate, and monthly repayments. Payments appear
          in Outgoings on the due day.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className="rounded-xl border border-[#dde2dd] px-3 py-2"
            placeholder="Debt name"
            value={debtName}
            onChange={(e) => setDebtName(e.target.value)}
          />
          <select
            className="rounded-xl border border-[#dde2dd] px-3 py-2"
            value={debtType}
            onChange={(e) => setDebtType(e.target.value as Debt["debtType"])}
          >
            {(meta?.debtTypes ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          {debtType === "other" ? (
            <input
              className="rounded-xl border border-[#dde2dd] px-3 py-2"
              placeholder="Custom type label"
              value={debtCustom}
              onChange={(e) => setDebtCustom(e.target.value)}
            />
          ) : null}
          <input
            className="rounded-xl border border-[#dde2dd] px-3 py-2"
            placeholder="Balance owed"
            value={debtBalance}
            onChange={(e) => setDebtBalance(e.target.value)}
          />
          <input
            className="rounded-xl border border-[#dde2dd] px-3 py-2"
            placeholder="Interest APR % (e.g. 19.9)"
            value={debtApr}
            onChange={(e) => setDebtApr(e.target.value)}
          />
          <input
            className="rounded-xl border border-[#dde2dd] px-3 py-2"
            placeholder="Monthly payment"
            value={debtPayment}
            onChange={(e) => setDebtPayment(e.target.value)}
          />
          <input
            className="rounded-xl border border-[#dde2dd] px-3 py-2"
            type="number"
            min={1}
            max={28}
            placeholder="Payment day"
            value={debtDay}
            onChange={(e) => setDebtDay(e.target.value)}
          />
          <input
            className="rounded-xl border border-[#dde2dd] px-3 py-2 sm:col-span-2"
            placeholder="Note (e.g. Paid from current account)"
            value={debtNote}
            onChange={(e) => setDebtNote(e.target.value)}
          />
        </div>
        {canShare ? (
          <label className="flex items-center gap-2 text-xs font-bold">
            <input
              type="checkbox"
              checked={debtShared}
              onChange={(e) => setDebtShared(e.target.checked)}
            />
            Share with household
          </label>
        ) : null}
        <button
          type="button"
          disabled={busy}
          className="rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-[#f4f5f0] disabled:opacity-50"
          onClick={() =>
            void run(async () => {
              if (!debtName.trim()) throw new Error("Name the debt.");
              const payment = Number(debtPayment);
              const hasPayment =
                debtPayment.trim() !== "" &&
                Number.isFinite(payment) &&
                payment > 0;
              await createDebt({
                name: debtName.trim(),
                debtType,
                customLabel:
                  debtType === "other" ? debtCustom.trim() : undefined,
                balanceCents: Math.round(Number(debtBalance || 0) * 100),
                interestAprPercent: Number(debtApr || 0),
                monthlyPaymentCents: hasPayment
                  ? Math.round(payment * 100)
                  : null,
                paymentDay: hasPayment ? Number(debtDay || 1) : null,
                note: debtNote.trim() || undefined,
                visibility: debtShared ? "SHARED" : "PRIVATE",
              });
              setDebtName("");
              setDebtBalance("");
              setDebtApr("");
              setDebtPayment("");
              setDebtCustom("");
              setDebtNote("");
            })
          }
        >
          Add debt
        </button>
        {debts.map((debt) => (
          <div key={debt.id} className="border-t border-[#dde2dd] pt-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{debt.name}</p>
                <p className="text-xs text-[#6c7771]">
                  {debt.customLabel ??
                    meta?.debtTypes.find((t) => t.id === debt.debtType)?.label ??
                    debt.debtType}
                  {debt.visibility === "SHARED" ? " · Shared" : ""}
                  {debt.note ? ` · ${debt.note}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="text-xs font-bold text-[#c9634f]"
                disabled={busy}
                onClick={() => void run(async () => deleteDebt(debt.id))}
              >
                Remove
              </button>
            </div>
            <p className="mt-1 text-sm">
              Balance {money(debt.balanceCents)} · APR {debt.interestAprPercent}%
              · Est. interest {money(debt.estimatedMonthlyInterestCents ?? 0)}
              /mo
            </p>
            {debt.monthlyPaymentCents ? (
              <p className="mt-1 text-xs text-[#6c7771]">
                Pays {money(debt.monthlyPaymentCents)} on day {debt.paymentDay}
                {debt.estimatedPayoffMonths
                  ? ` · ~${debt.estimatedPayoffMonths} months to clear`
                  : ""}
              </p>
            ) : (
              <p className="mt-1 text-xs text-[#6c7771]">
                Add a monthly payment to track it in Outgoings.
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-xl border border-[#dde2dd] px-3 py-1 text-xs font-bold"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await updateDebt(debt.id, {
                      balanceCents: Math.max(0, debt.balanceCents - 5000),
                    });
                  })
                }
              >
                −50 balance
              </button>
              <button
                type="button"
                className="rounded-xl border border-[#dde2dd] px-3 py-1 text-xs font-bold"
                disabled={busy || (debt.estimatedMonthlyInterestCents ?? 0) <= 0}
                onClick={() =>
                  void run(async () => {
                    await accrueDebtInterest(debt.id);
                  })
                }
              >
                Add this month&apos;s interest
              </button>
            </div>
          </div>
        ))}
      </article>

      {budgetId ? (
        <article className="space-y-3 rounded-2xl border border-[#dde2dd] bg-white p-5">
          <h3 className="font-serif text-2xl">Draft monthly expense</h3>
          <p className="text-sm text-[#6c7771]">
            What-if a new bill — see how it changes remaining budget before you
            commit.
          </p>
          {impact ? (
            <div
              className={`rounded-xl p-3 text-sm ${
                impact.impact.wouldOverspend
                  ? "bg-[#f8e4df] text-[#8a3d30]"
                  : "bg-[#dbe8d7] text-[#2f431e]"
              }`}
            >
              <p>
                Remaining without drafts:{" "}
                {money(impact.impact.remainingWithoutDraftsCents)}
              </p>
              <p>
                After drafts ({money(impact.impact.draftCents)}):{" "}
                {money(impact.impact.remainingWithDraftsCents)}
              </p>
              {impact.impact.wouldOverspend ? (
                <p className="mt-1 font-bold">
                  Flag: would overspend by {money(impact.impact.overspendCents)}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <input
              className="min-w-[140px] flex-1 rounded-xl border border-[#dde2dd] px-3 py-2"
              placeholder="Draft expense name"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
            />
            <input
              className="w-28 rounded-xl border border-[#dde2dd] px-3 py-2"
              placeholder="Amount"
              value={draftAmount}
              onChange={(e) => setDraftAmount(e.target.value)}
            />
            <button
              type="button"
              disabled={busy}
              className="rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-[#f4f5f0]"
              onClick={() =>
                void run(async () => {
                  const pounds = Number(draftAmount);
                  if (!draftName.trim() || !Number.isFinite(pounds) || pounds <= 0) {
                    throw new Error("Enter a name and positive amount.");
                  }
                  await createDraftExpense(budgetId, {
                    name: draftName.trim(),
                    amountCents: Math.round(pounds * 100),
                  });
                  setDraftName("");
                  setDraftAmount("");
                })
              }
            >
              Add draft
            </button>
          </div>
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="flex items-center justify-between border-t border-[#dde2dd] pt-3 text-sm"
            >
              <p>
                {draft.name} · {money(draft.amountCents)}
                {!draft.active ? " (off)" : ""}
              </p>
              <button
                type="button"
                className="text-xs font-bold text-[#c9634f]"
                disabled={busy}
                onClick={() =>
                  void run(async () => deleteDraftExpense(budgetId, draft.id))
                }
              >
                Remove
              </button>
            </div>
          ))}
          <p className="text-xs text-[#9ba49e]">
            Signed in as {account.user.displayName} · currency {currency}
          </p>
        </article>
      ) : (
        <p className="text-sm text-[#6c7771]">
          Create a budget to simulate draft monthly expenses.
        </p>
      )}
    </section>
  );
}
