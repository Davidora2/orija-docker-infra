"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addBudgetEntry,
  createBudget,
  formatMoney,
  getBudget,
  listBudgets,
  updateBudgetCategory,
  type Account,
  type Budget,
} from "../lib/api";
import { OutgoingsPanel } from "./outgoings-panel";
import { WealthPanel } from "./wealth-panel";

type Props = {
  account: Account;
  onError: (message: string) => void;
};

export function BudgetPanel({ account, onError }: Props) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Budget | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<"ledger" | "outgoings" | "wealth">(
    "outgoings",
  );
  const canShare = (account.members?.length ?? 0) >= 2;
  const currency = account.user.preferredCurrency || "GBP";

  const reload = useCallback(async () => {
    const list = await listBudgets();
    setBudgets(list);
    const nextId =
      activeId && list.some((budget) => budget.id === activeId)
        ? activeId
        : (list[0]?.id ?? null);
    setActiveId(nextId);
    if (nextId) setDetail(await getBudget(nextId));
    else setDetail(null);
  }, [activeId]);

  useEffect(() => {
    void reload().catch((error) =>
      onError(error instanceof Error ? error.message : "Could not load budgets."),
    );
  }, [reload, onError, account.user.preferredCurrency]);

  useEffect(() => {
    if (detail?.categories?.[0] && !categoryId) {
      setCategoryId(detail.categories[0].id);
    }
  }, [detail, categoryId]);

  async function create(visibility: "PRIVATE" | "SHARED") {
    setBusy(true);
    try {
      const created = await createBudget({
        name: visibility === "SHARED" ? "Shared budget" : "Personal budget",
        visibility,
        currency,
      });
      setActiveId(created.id);
      await reload();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not create budget.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEntry() {
    if (!detail) return;
    const pounds = Number(amount);
    if (!Number.isFinite(pounds) || pounds <= 0) {
      onError("Enter a positive amount.");
      return;
    }
    setBusy(true);
    try {
      await addBudgetEntry(detail.id, {
        kind,
        amountCents: Math.round(pounds * 100),
        categoryId: kind === "EXPENSE" ? categoryId : null,
        note: note.trim(),
      });
      setAmount("");
      setNote("");
      setDetail(await getBudget(detail.id));
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not save entry.");
    } finally {
      setBusy(false);
    }
  }

  async function setPlanned(categoryIdToUpdate: string, planned: string) {
    if (!detail) return;
    const pounds = Number(planned);
    if (!Number.isFinite(pounds) || pounds < 0) return;
    try {
      await updateBudgetCategory(detail.id, categoryIdToUpdate, {
        plannedCents: Math.round(pounds * 100),
      });
      setDetail(await getBudget(detail.id));
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not update category.");
    }
  }

  return (
    <section className="space-y-4">
      <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
        <h2 className="font-serif text-2xl">Budgets</h2>
        <p className="mt-1 text-sm text-[#6c7771]">
          Keep a personal budget private. Shared budgets are visible to your linked
          partner.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            className="rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-[#f4f5f0] disabled:opacity-50"
            onClick={() => void create("PRIVATE")}
          >
            + Personal
          </button>
          <button
            type="button"
            disabled={!canShare || busy}
            className="rounded-xl border border-[#dde2dd] px-4 py-2 text-xs font-bold disabled:opacity-50"
            onClick={() => void create("SHARED")}
          >
            + Shared
          </button>
        </div>
        {!canShare ? (
          <p className="mt-2 text-xs text-[#6c7771]">
            Link a partner account to create a shared household budget.
          </p>
        ) : null}
      </article>

      {budgets.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {budgets.map((budget) => (
            <button
              key={budget.id}
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                activeId === budget.id
                  ? "bg-[#14241f] text-[#d6f57a]"
                  : "border border-[#dde2dd] bg-white text-[#14241f]"
              }`}
              onClick={() => {
                setActiveId(budget.id);
                setCategoryId(null);
                void getBudget(budget.id).then(setDetail);
              }}
            >
              {budget.name} · {budget.visibility === "SHARED" ? "Shared" : "Personal"}
            </button>
          ))}
        </div>
      ) : (
        <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
          <p className="font-semibold">No budgets yet</p>
          <p className="mt-1 text-sm text-[#6c7771]">
            Create a personal budget to track income and spending.
          </p>
        </article>
      )}

      {detail ? (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                section === "outgoings"
                  ? "bg-[#14241f] text-[#f4f5f0]"
                  : "border border-[#dde2dd] bg-white text-[#14241f]"
              }`}
              onClick={() => setSection("outgoings")}
            >
              Outgoings
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                section === "ledger"
                  ? "bg-[#14241f] text-[#f4f5f0]"
                  : "border border-[#dde2dd] bg-white text-[#14241f]"
              }`}
              onClick={() => setSection("ledger")}
            >
              Ledger
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                section === "wealth"
                  ? "bg-[#14241f] text-[#f4f5f0]"
                  : "border border-[#dde2dd] bg-white text-[#14241f]"
              }`}
              onClick={() => setSection("wealth")}
            >
              Savings & investing
            </button>
          </div>

          {section === "outgoings" ? (
            <OutgoingsPanel
              budget={detail}
              onError={onError}
              onChanged={() => void reload()}
            />
          ) : null}

          {section === "wealth" ? (
            <WealthPanel
              account={account}
              budgetId={detail.id}
              currency={detail.currency || currency}
              canShare={canShare}
              onError={onError}
            />
          ) : null}

          {section === "ledger" ? (
            <>
          <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
              This period
            </p>
            <h3 className="mt-2 font-serif text-2xl">
              {formatMoney(detail.summary?.balanceCents ?? 0, detail.currency)}
            </h3>
            <p className="text-sm text-[#6c7771]">
              In {formatMoney(detail.summary?.incomeCents ?? 0, detail.currency)} · Out{" "}
              {formatMoney(detail.summary?.expenseCents ?? 0, detail.currency)} · Planned{" "}
              {formatMoney(detail.summary?.plannedCents ?? 0, detail.currency)}
            </p>
          </article>

          <article className="rounded-2xl border border-[#dde2dd] bg-white p-5 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
              Categories
            </p>
            {(detail.categories ?? []).map((category) => (
              <div
                key={category.id}
                className="flex items-center gap-3 border-t border-[#dde2dd] pt-3 first:border-0 first:pt-0"
              >
                <div className="flex-1">
                  <p className="font-semibold">{category.name}</p>
                  <p className="text-xs text-[#6c7771]">
                    Spent {formatMoney(category.spentCents ?? 0, detail.currency)}
                  </p>
                </div>
                <input
                  className="w-20 rounded-lg border border-[#dde2dd] px-2 py-2 text-right text-sm"
                  defaultValue={(category.plannedCents / 100).toFixed(0)}
                  onBlur={(e) => void setPlanned(category.id, e.target.value)}
                  aria-label={`${category.name} planned amount`}
                />
              </div>
            ))}
          </article>

          <article className="rounded-2xl border border-[#dde2dd] bg-white p-5 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
              Add entry
            </p>
            <div className="flex gap-2">
              {(["EXPENSE", "INCOME"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                    kind === value
                      ? "bg-[#14241f] text-[#d6f57a]"
                      : "border border-[#dde2dd]"
                  }`}
                  onClick={() => setKind(value)}
                >
                  {value === "EXPENSE" ? "Expense" : "Income"}
                </button>
              ))}
            </div>
            {kind === "EXPENSE" ? (
              <div className="flex flex-wrap gap-2">
                {(detail.categories ?? []).map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                      categoryId === category.id
                        ? "bg-[#14241f] text-[#d6f57a]"
                        : "border border-[#dde2dd]"
                    }`}
                    onClick={() => setCategoryId(category.id)}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            ) : null}
            <input
              className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <input
              className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
              placeholder="Note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              type="button"
              disabled={busy}
              className="rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-[#f4f5f0] disabled:opacity-50"
              onClick={() => void saveEntry()}
            >
              Save entry
            </button>
          </article>

          <article className="rounded-2xl border border-[#dde2dd] bg-white p-5 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
              Recent
            </p>
            {(detail.entries ?? []).slice(0, 12).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between border-t border-[#dde2dd] pt-3 first:border-0 first:pt-0"
              >
                <div>
                  <p className="font-semibold">
                    {entry.kind === "INCOME" ? "Income" : "Expense"}
                    {entry.note ? ` · ${entry.note}` : ""}
                  </p>
                  <p className="text-xs text-[#6c7771]">{entry.occurredOn}</p>
                </div>
                <p
                  className={`font-bold ${
                    entry.kind === "INCOME" ? "text-[#617a57]" : "text-[#c9634f]"
                  }`}
                >
                  {entry.kind === "INCOME" ? "+" : "-"}
                  {formatMoney(entry.amountCents, detail.currency)}
                </p>
              </div>
            ))}
          </article>
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
