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
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<"outgoings" | "wealth" | "dashboard">(
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

  return (
    <section className="space-y-4">
      <article className="rounded-2xl border border-[#dde2dd] bg-white p-5">
        <h2 className="font-serif text-2xl">Budgets</h2>
        <p className="mt-1 text-sm text-[#6c7771]">
          Keep a personal budget private. Shared budgets are visible to your linked
          partner. Daily expenses live inside Outgoings so they count toward this
          month&apos;s total and pay delta.
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
                section === "wealth"
                  ? "bg-[#14241f] text-[#f4f5f0]"
                  : "border border-[#dde2dd] bg-white text-[#14241f]"
              }`}
              onClick={() => setSection("wealth")}
            >
              Savings & investing
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                section === "dashboard"
                  ? "bg-[#14241f] text-[#f4f5f0]"
                  : "border border-[#dde2dd] bg-white text-[#14241f]"
              }`}
              onClick={() => setSection("dashboard")}
            >
              Dashboard
            </button>
          </div>

          {section === "outgoings" ? (
            <OutgoingsPanel
              budget={detail}
              preferredCurrency={currency}
              onError={onError}
              onChanged={() => void reload()}
            />
          ) : null}

          {section === "wealth" ? (
            <WealthPanel
              account={account}
              budgetId={detail.id}
              currency={currency}
              canShare={canShare}
              onError={onError}
            />
          ) : null}

          {section === "dashboard" ? (
            <DashboardPanel
              budgetId={detail.id}
              currency={currency}
              onError={onError}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}
