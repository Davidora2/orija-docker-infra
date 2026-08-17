"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addBudgetEntry,
  createBudgetCategory,
  createRecurringOutgoing,
  currencySymbol,
  deleteRecurringOutgoing,
  formatMoney,
  getMonthOutgoings,
  listRecurringOutgoings,
  markOutgoingPaid,
  unmarkOutgoingPaid,
  updateBudget,
  updateBudgetEntry,
  updateRecurringOutgoing,
  type Budget,
  type MonthOutgoings,
  type OutgoingItem,
  type RecurringOutgoing,
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
  const [view, setView] = useState<"calendar" | "list" | "category">("calendar");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [data, setData] = useState<MonthOutgoings | null>(null);
  const [recurringRows, setRecurringRows] = useState<RecurringOutgoing[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editWeekday, setEditWeekday] = useState("1");
  const [editDate, setEditDate] = useState("");
  const [editCategoryId, setEditCategoryId] = useState<string>("");
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
  const [recCadence, setRecCadence] = useState<
    "weekly" | "biweekly" | "four_weekly" | "monthly" | "yearly"
  >("monthly");
  const [recWeekday, setRecWeekday] = useState("1");
  const [recAnchor, setRecAnchor] = useState("");
  const [recNote, setRecNote] = useState("");
  const [recCategoryId, setRecCategoryId] = useState<string>("");
  const [recDueDate, setRecDueDate] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(Math.min(today.getDate(), 28)).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });

  const [dailyAmount, setDailyAmount] = useState("");
  const [dailyNote, setDailyNote] = useState("");
  const [dailyCategoryId, setDailyCategoryId] = useState<string | null>(null);
  const [dailyDate, setDailyDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categories, setCategories] = useState(budget.categories ?? []);

  const displayCurrency =
    preferredCurrency || data?.currency || budget.currency || "GBP";
  const symbol = currencySymbol(displayCurrency);

  useEffect(() => {
    setPayFrequency(budget.payFrequency ?? "monthly");
    setNextPayDate(budget.nextPayDate ?? "");
    setTypicalPay(
      budget.typicalPayCents != null ? String(budget.typicalPayCents / 100) : "",
    );
    setCategories(budget.categories ?? []);
    if (!dailyCategoryId && budget.categories?.[0]) {
      setDailyCategoryId(budget.categories[0].id);
    }
  }, [
    budget.id,
    budget.payFrequency,
    budget.nextPayDate,
    budget.typicalPayCents,
    budget.categories,
    dailyCategoryId,
  ]);

  const load = useCallback(async () => {
    const [next, recurring] = await Promise.all([
      getMonthOutgoings(budget.id, year, month),
      listRecurringOutgoings(budget.id),
    ]);
    setData(next);
    setRecurringRows(recurring);
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

  function matchesCategoryFilter(item: {
    categoryId: string | null;
  }) {
    if (categoryFilter === "all") return true;
    if (categoryFilter === "uncategorised") return !item.categoryId;
    return item.categoryId === categoryFilter;
  }

  const filteredList = useMemo(() => {
    if (!data) return [];
    return data.list.filter(matchesCategoryFilter);
  }, [data, categoryFilter]);

  const filteredSelectedItems = useMemo(() => {
    if (!selectedDay) return [];
    return selectedDay.items.filter(matchesCategoryFilter);
  }, [selectedDay, categoryFilter]);

  const categoryGroups = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; label: string; totalCents: number; items: OutgoingItem[] }
    >();
    for (const item of filteredList) {
      const key = item.categoryId ?? "uncategorised";
      const label =
        item.categoryName ??
        (item.categoryId
          ? categories.find((category) => category.id === item.categoryId)?.name
          : null) ??
        "Uncategorised";
      const existing = groups.get(key);
      if (existing) {
        existing.totalCents += item.amountCents;
        existing.items.push(item);
      } else {
        groups.set(key, {
          key,
          label,
          totalCents: item.amountCents,
          items: [item],
        });
      }
    }
    return [...groups.values()].sort((a, b) => b.totalCents - a.totalCents);
  }, [filteredList, categories]);

  const filteredTotalCents = useMemo(
    () => filteredList.reduce((sum, item) => sum + item.amountCents, 0),
    [filteredList],
  );

  function categoryLabel(categoryId: string | null | undefined) {
    if (!categoryId) return "Uncategorised";
    return (
      categories.find((category) => category.id === categoryId)?.name ??
      "Uncategorised"
    );
  }

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

  async function addDailyExpense() {
    const pounds = Number(dailyAmount);
    if (!Number.isFinite(pounds) || pounds <= 0) {
      onError("Enter a positive amount for the daily expense.");
      return;
    }
    setBusy(true);
    try {
      await addBudgetEntry(budget.id, {
        kind: "EXPENSE",
        amountCents: Math.round(pounds * 100),
        categoryId: dailyCategoryId,
        note: dailyNote.trim(),
        occurredOn: dailyDate || undefined,
      });
      setDailyAmount("");
      setDailyNote("");
      await load();
      onChanged();
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Could not save daily expense.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function addCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      onError("Enter a category name.");
      return;
    }
    setBusy(true);
    try {
      const created = await createBudgetCategory(budget.id, { name });
      setCategories((prev) => [...prev, created]);
      setDailyCategoryId(created.id);
      setNewCategoryName("");
      onChanged();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not add category.");
    } finally {
      setBusy(false);
    }
  }

  async function changeEntryCategory(entryId: string, categoryId: string) {
    setBusy(true);
    try {
      await updateBudgetEntry(budget.id, entryId, {
        categoryId: categoryId || null,
      });
      await load();
      onChanged();
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Could not update category.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeRecurringCategory(
    recurringId: string,
    categoryId: string,
  ) {
    setBusy(true);
    try {
      await updateRecurringOutgoing(budget.id, recurringId, {
        categoryId: categoryId || null,
      });
      await load();
      onChanged();
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Could not update category.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeItemCategory(item: OutgoingItem, categoryId: string) {
    if (item.source === "entry") {
      await changeEntryCategory(item.id, categoryId);
      return;
    }
    if (item.source === "recurring" && item.recurringId) {
      await changeRecurringCategory(item.recurringId, categoryId);
    }
  }

  async function addRecurring() {
    const pounds = Number(recAmount);
    if (!recName.trim() || !Number.isFinite(pounds) || pounds <= 0) {
      onError("Add a name and positive amount for the recurring outgoing.");
      return;
    }
    if (
      (recCadence === "biweekly" || recCadence === "four_weekly") &&
      !(recAnchor || recDueDate)
    ) {
      onError("Pick the next payment date for every 2 / 4 week outgoings.");
      return;
    }
    if (
      (recCadence === "monthly" || recCadence === "yearly") &&
      !recDueDate
    ) {
      onError("Pick a payment due date.");
      return;
    }
    setBusy(true);
    try {
      const dueDay = Number((recDueDate || recAnchor).slice(8, 10));
      await createRecurringOutgoing(budget.id, {
        name: recName.trim(),
        amountCents: Math.round(pounds * 100),
        cadence: recCadence,
        dayOfMonth:
          recCadence === "monthly" || recCadence === "yearly"
            ? Math.min(Math.max(dueDay || Number(recDay) || 1, 1), 28)
            : null,
        weekday: recCadence === "weekly" ? Number(recWeekday) : null,
        anchorDate:
          recCadence === "biweekly" || recCadence === "four_weekly"
            ? recAnchor || recDueDate
            : null,
        note: recNote.trim() || undefined,
        categoryId: recCategoryId || null,
      });
      setRecName("");
      setRecAmount("");
      setRecAnchor("");
      setRecNote("");
      setRecCategoryId("");
      await load();
      onChanged();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not add recurring outgoing.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePaid(item: OutgoingItem) {
    if (
      item.source !== "recurring" &&
      item.source !== "saving" &&
      item.source !== "debt"
    )
      return;
    setBusy(true);
    try {
      if (item.paid && item.paymentId) {
        await unmarkOutgoingPaid(budget.id, item.paymentId);
      } else {
        const sourceId =
          item.source === "recurring"
            ? item.recurringId
            : item.source === "saving"
              ? item.savingGoalId
              : item.debtId;
        if (!sourceId) throw new Error("Missing payment source.");
        await markOutgoingPaid(budget.id, {
          sourceType:
            item.source === "recurring"
              ? "recurring_outgoing"
              : item.source === "saving"
                ? "saving_goal"
                : "debt",
          sourceId,
          dueDate: item.date,
        });
      }
      await load();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not update payment.");
    } finally {
      setBusy(false);
    }
  }

  function sourceLabel(item: OutgoingItem) {
    if (item.source === "recurring") return "Bill";
    if (item.source === "saving") return "Savings";
    if (item.source === "debt") return "Debt";
    return "Daily";
  }

  function PaymentToggle({ item }: { item: OutgoingItem }) {
    if (
      item.source !== "recurring" &&
      item.source !== "saving" &&
      item.source !== "debt"
    )
      return null;
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => void togglePaid(item)}
        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold disabled:opacity-50 ${
          item.paid
            ? "bg-[#dbe8d7] text-[#617a57]"
            : "bg-[#f4e4df] text-[#c9634f]"
        }`}
      >
        {item.paid ? "Paid" : "Mark paid"}
      </button>
    );
  }

  function cadenceLabel(cadence: RecurringOutgoing["cadence"]) {
    if (cadence === "biweekly") return "Every 2 weeks";
    if (cadence === "four_weekly") return "Every 4 weeks";
    return cadence[0]!.toUpperCase() + cadence.slice(1);
  }

  function scheduleSummary(row: RecurringOutgoing) {
    if (row.cadence === "weekly" && row.weekday != null) {
      return `Every ${WEEKDAYS[row.weekday]}`;
    }
    if (row.cadence === "biweekly" || row.cadence === "four_weekly") {
      return `Next ${row.anchorDate ?? "—"}`;
    }
    return `Day ${row.dayOfMonth ?? "—"}`;
  }

  function startEdit(row: RecurringOutgoing) {
    setEditingId(row.id);
    setEditName(row.name);
    setEditAmount(String(row.amountCents / 100));
    setEditNote(row.note ?? "");
    setEditWeekday(String(row.weekday ?? 1));
    setEditCategoryId(row.categoryId ?? "");
    if (row.cadence === "biweekly" || row.cadence === "four_weekly") {
      setEditDate(row.anchorDate ?? "");
    } else if (row.dayOfMonth) {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, "0");
      setEditDate(`${y}-${m}-${String(row.dayOfMonth).padStart(2, "0")}`);
    } else {
      setEditDate("");
    }
  }

  async function saveEdit(row: RecurringOutgoing) {
    const pounds = Number(editAmount);
    if (!editName.trim() || !Number.isFinite(pounds) || pounds <= 0) {
      onError("Name and positive amount are required.");
      return;
    }
    setBusy(true);
    try {
      const patch: Parameters<typeof updateRecurringOutgoing>[2] = {
        name: editName.trim(),
        amountCents: Math.round(pounds * 100),
        note: editNote.trim(),
        categoryId: editCategoryId || null,
      };
      if (row.cadence === "weekly") {
        patch.weekday = Number(editWeekday);
      } else if (row.cadence === "biweekly" || row.cadence === "four_weekly") {
        if (!editDate) {
          onError("Pick the next payment date.");
          setBusy(false);
          return;
        }
        patch.anchorDate = editDate;
      } else {
        if (!editDate) {
          onError("Pick a payment due date.");
          setBusy(false);
          return;
        }
        const day = Math.min(Math.max(Number(editDate.slice(8, 10)) || 1, 1), 28);
        patch.dayOfMonth = day;
      }
      await updateRecurringOutgoing(budget.id, row.id, patch);
      setEditingId(null);
      await load();
      onChanged();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not update recurring bill.");
    } finally {
      setBusy(false);
    }
  }

  async function removeRecurring(row: RecurringOutgoing) {
    setBusy(true);
    try {
      await deleteRecurringOutgoing(budget.id, row.id);
      if (editingId === row.id) setEditingId(null);
      await load();
      onChanged();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not remove recurring bill.");
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
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                view === "category"
                  ? "bg-[#14241f] text-[#f4f5f0]"
                  : "border border-[#dde2dd] text-[#14241f]"
              }`}
              onClick={() => setView("category")}
            >
              By category
            </button>
          </div>
        </div>
        {data ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                categoryFilter === "all"
                  ? "bg-[#14241f] text-[#f4f5f0]"
                  : "border border-[#dde2dd] text-[#14241f]"
              }`}
              onClick={() => setCategoryFilter("all")}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  categoryFilter === category.id
                    ? "bg-[#14241f] text-[#f4f5f0]"
                    : "border border-[#dde2dd] text-[#14241f]"
                }`}
                onClick={() => setCategoryFilter(category.id)}
              >
                {category.name}
              </button>
            ))}
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                categoryFilter === "uncategorised"
                  ? "bg-[#14241f] text-[#f4f5f0]"
                  : "border border-[#dde2dd] text-[#14241f]"
              }`}
              onClick={() => setCategoryFilter("uncategorised")}
            >
              Uncategorised
            </button>
          </div>
        ) : null}
        {data && categoryFilter !== "all" ? (
          <p className="mt-2 text-sm text-[#6c7771]">
            Filtered total{" "}
            <span className="font-semibold text-[#14241f]">
              {formatMoney(filteredTotalCents, displayCurrency)}
            </span>
            {" · "}
            {filteredList.length} item{filteredList.length === 1 ? "" : "s"}
          </p>
        ) : null}
        {data ? (
          <div className="mt-3 space-y-1 text-sm text-[#6c7771]">
            <p className="font-serif text-2xl text-[#14241f]">
              {formatMoney(data.totals.expenseCents, displayCurrency)}{" "}
              <span className="text-base font-sans font-normal text-[#6c7771]">
                total out this month
              </span>
            </p>
            <p>
              {formatMoney(
                data.totals.recurringCents ?? 0,
                displayCurrency,
              )}{" "}
              bills ·{" "}
              {formatMoney(
                data.totals.dailyExpenseCents ?? data.totals.oneOffCents,
                displayCurrency,
              )}{" "}
              daily
              {(data.totals.savingContributionCents ?? 0) > 0
                ? ` · ${formatMoney(data.totals.savingContributionCents ?? 0, displayCurrency)} savings`
                : ""}
              {(data.totals.debtPaymentCents ?? 0) > 0
                ? ` · ${formatMoney(data.totals.debtPaymentCents ?? 0, displayCurrency)} debts`
                : ""}
              {data.totals.outstandingCents != null ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-semibold text-[#c9634f]">
                    {formatMoney(data.totals.outstandingCents, displayCurrency)}{" "}
                    outstanding
                  </span>
                </>
              ) : null}
            </p>
            {data.totals.expectedPayCents != null &&
            data.totals.deltaCents != null ? (
              <p>
                Expected pay{" "}
                {formatMoney(data.totals.expectedPayCents, displayCurrency)}
                {" · "}
                <span
                  className={`font-semibold ${
                    data.totals.deltaCents >= 0
                      ? "text-[#617a57]"
                      : "text-[#c9634f]"
                  }`}
                >
                  {data.totals.deltaCents >= 0 ? "+" : "−"}
                  {formatMoney(Math.abs(data.totals.deltaCents), displayCurrency)}{" "}
                  {data.totals.deltaCents >= 0 ? "left" : "over"}
                </span>
              </p>
            ) : (
              <p className="text-xs">
                Set typical pay in Pay schedule to see pay vs outgoings delta.
              </p>
            )}
          </div>
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

      <article className="rounded-2xl border border-[#dde2dd] bg-white p-5 space-y-3">
        <h4 className="font-semibold">Add daily expense</h4>
        <p className="text-sm text-[#6c7771]">
          One-off spends count toward this month&apos;s total outgoings and delta.
        </p>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                dailyCategoryId === category.id
                  ? "bg-[#14241f] text-[#d6f57a]"
                  : "border border-[#dde2dd]"
              }`}
              onClick={() => setDailyCategoryId(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-[10rem] flex-1 rounded-xl border border-[#dde2dd] px-3 py-3"
            placeholder="New category"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
          />
          <button
            type="button"
            disabled={busy}
            className="rounded-xl border border-[#dde2dd] px-4 py-2 text-xs font-bold disabled:opacity-50"
            onClick={() => void addCategory()}
          >
            Add category
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
              Amount
            </span>
            <input
              className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
              placeholder={`Amount (${symbol})`}
              value={dailyAmount}
              onChange={(e) => setDailyAmount(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
              Date
            </span>
            <input
              className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
              type="date"
              value={dailyDate}
              onChange={(e) => setDailyDate(e.target.value)}
            />
          </label>
        </div>
        <input
          className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
          placeholder="Note (optional)"
          value={dailyNote}
          onChange={(e) => setDailyNote(e.target.value)}
        />
        <button
          type="button"
          disabled={busy}
          className="rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-[#f4f5f0] disabled:opacity-50"
          onClick={() => void addDailyExpense()}
        >
          Add to this month&apos;s outgoings
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
              const dayTotal = day.items
                .filter(matchesCategoryFilter)
                .reduce((sum, item) => sum + item.amountCents, 0);
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
                  {dayTotal > 0 ? (
                    <div className={`mt-1 text-[10px] ${active ? "text-[#d6f57a]" : "text-[#c9634f]"}`}>
                      {formatMoney(dayTotal, displayCurrency)}
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
              {filteredSelectedItems.length === 0 ? (
                <p className="text-sm text-[#6c7771]">
                  No outgoings on this day
                  {categoryFilter !== "all" ? " for this category" : ""}.
                </p>
              ) : (
                filteredSelectedItems.map((item) => (
                  <div key={item.id} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{item.title}</p>
                        <p className="text-xs text-[#6c7771]">
                          {sourceLabel(item)}
                          {item.categoryName || item.categoryId
                            ? ` · ${item.categoryName ?? categoryLabel(item.categoryId)}`
                            : ""}
                          {item.paid
                            ? " · paid"
                            : item.source !== "entry"
                              ? " · outstanding"
                              : ""}
                          {item.note ? ` · ${item.note}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <PaymentToggle item={item} />
                        <p
                          className={`font-bold ${
                            item.kind === "INCOME"
                              ? "text-[#617a57]"
                              : "text-[#c9634f]"
                          }`}
                        >
                          {item.kind === "INCOME" ? "+" : "-"}
                          {formatMoney(item.amountCents, displayCurrency)}
                        </p>
                      </div>
                    </div>
                    {item.source === "entry" || item.source === "recurring" ? (
                      <select
                        className="w-full rounded-xl border border-[#dde2dd] px-3 py-2 text-sm"
                        value={item.categoryId ?? ""}
                        disabled={busy}
                        onChange={(e) =>
                          void changeItemCategory(item, e.target.value)
                        }
                      >
                        <option value="">Uncategorised</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          ) : null}
        </article>
      ) : null}

      {data && view === "list" ? (
        <article className="rounded-2xl border border-[#dde2dd] bg-white p-5 space-y-3">
          {filteredList.length === 0 ? (
            <p className="text-sm text-[#6c7771]">
              No outgoings this month
              {categoryFilter !== "all" ? " for this category" : ""} yet.
            </p>
          ) : (
            filteredList.map((item) => (
              <div
                key={item.id}
                className="space-y-2 border-t border-[#dde2dd] pt-3 first:border-0 first:pt-0"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-xs text-[#6c7771]">
                      {item.date} · {sourceLabel(item)}
                      {item.categoryName || item.categoryId
                        ? ` · ${item.categoryName ?? categoryLabel(item.categoryId)}`
                        : ""}
                      {item.paid
                        ? " · paid"
                        : item.source !== "entry"
                          ? " · outstanding"
                          : ""}
                      {item.note ? ` · ${item.note}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PaymentToggle item={item} />
                    <p className="font-bold text-[#c9634f]">
                      -{formatMoney(item.amountCents, displayCurrency)}
                    </p>
                  </div>
                </div>
                {item.source === "entry" || item.source === "recurring" ? (
                  <select
                    className="w-full rounded-xl border border-[#dde2dd] px-3 py-2 text-sm"
                    value={item.categoryId ?? ""}
                    disabled={busy}
                    onChange={(e) =>
                      void changeItemCategory(item, e.target.value)
                    }
                  >
                    <option value="">Uncategorised</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            ))
          )}
        </article>
      ) : null}

      {data && view === "category" ? (
        <article className="rounded-2xl border border-[#dde2dd] bg-white p-5 space-y-4">
          <div>
            <h4 className="font-semibold">Outgoings by category</h4>
            <p className="text-sm text-[#6c7771]">
              Daily expenses and recurring bills grouped together. Filter with
              the chips above when you want one category only.
            </p>
          </div>
          {categoryGroups.length === 0 ? (
            <p className="text-sm text-[#6c7771]">Nothing to show for this filter.</p>
          ) : (
            categoryGroups.map((group) => (
              <div
                key={group.key}
                className="space-y-2 border-t border-[#dde2dd] pt-3 first:border-0 first:pt-0"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{group.label}</p>
                  <p className="font-bold text-[#c9634f]">
                    {formatMoney(group.totalCents, displayCurrency)}
                  </p>
                </div>
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-[#f7f8f5] px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="text-xs text-[#6c7771]">
                        {item.date} · {sourceLabel(item)}
                        {item.note ? ` · ${item.note}` : ""}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-[#c9634f]">
                      -{formatMoney(item.amountCents, displayCurrency)}
                    </p>
                  </div>
                ))}
              </div>
            ))
          )}
        </article>
      ) : null}

      <article className="rounded-2xl border border-[#dde2dd] bg-white p-5 space-y-3">
        <h4 className="font-semibold">Your recurring bills</h4>
        <p className="text-sm text-[#6c7771]">
          Edit due days, notes (e.g. which account pays), or remove a bill.
        </p>
        {recurringRows.length === 0 ? (
          <p className="text-sm text-[#6c7771]">No recurring bills yet.</p>
        ) : (
          recurringRows.map((row) => (
            <div
              key={row.id}
              className="space-y-2 border-t border-[#dde2dd] pt-3 first:border-0 first:pt-0"
            >
              {editingId === row.id ? (
                <div className="space-y-2">
                  <input
                    className="w-full rounded-xl border border-[#dde2dd] px-3 py-2"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                  <input
                    className="w-full rounded-xl border border-[#dde2dd] px-3 py-2"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    placeholder={`Amount (${symbol})`}
                  />
                  {row.cadence === "weekly" ? (
                    <label className="block space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
                        Due every
                      </span>
                      <select
                        className="w-full rounded-xl border border-[#dde2dd] px-3 py-2"
                        value={editWeekday}
                        onChange={(e) => setEditWeekday(e.target.value)}
                      >
                        {WEEKDAYS.map((label, index) => (
                          <option key={label} value={index}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <label className="block space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
                        {row.cadence === "biweekly" || row.cadence === "four_weekly"
                          ? "Next payment date"
                          : "Payment due date"}
                      </span>
                      <input
                        className="w-full rounded-xl border border-[#dde2dd] px-3 py-2"
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                      />
                    </label>
                  )}
                  <textarea
                    className="w-full rounded-xl border border-[#dde2dd] px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Note — e.g. Paid from joint account"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                  />
                  <label className="block space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
                      Category
                    </span>
                    <select
                      className="w-full rounded-xl border border-[#dde2dd] px-3 py-2 text-sm"
                      value={editCategoryId}
                      onChange={(e) => setEditCategoryId(e.target.value)}
                    >
                      <option value="">Uncategorised</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-xl bg-[#14241f] px-3 py-2 text-xs font-bold text-[#f4f5f0] disabled:opacity-50"
                      onClick={() => void saveEdit(row)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-[#dde2dd] px-3 py-2 text-xs font-bold"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{row.name}</p>
                    <p className="text-xs text-[#6c7771]">
                      {formatMoney(row.amountCents, displayCurrency)} ·{" "}
                      {cadenceLabel(row.cadence)} · {scheduleSummary(row)}
                      {` · ${categoryLabel(row.categoryId)}`}
                      {row.note ? ` · ${row.note}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-[#dde2dd] px-2.5 py-1 text-[11px] font-bold"
                      onClick={() => startEdit(row)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-[#c9634f] disabled:opacity-50"
                      onClick={() => void removeRecurring(row)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </article>

      <article className="rounded-2xl border border-[#dde2dd] bg-white p-5 space-y-3">
        <h4 className="font-semibold">Add recurring outgoing</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
              Name
            </span>
            <input
              className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
              placeholder="e.g. Rent, Netflix"
              value={recName}
              onChange={(e) => setRecName(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
              Amount
            </span>
            <input
              className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
              placeholder={`Amount (${symbol})`}
              value={recAmount}
              onChange={(e) => setRecAmount(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
              How often
            </span>
            <select
              className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
              value={recCadence}
              onChange={(e) =>
                setRecCadence(
                  e.target.value as
                    | "weekly"
                    | "biweekly"
                    | "four_weekly"
                    | "monthly"
                    | "yearly",
                )
              }
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="four_weekly">Every 4 weeks</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
          {recCadence === "weekly" ? (
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
                Due every
              </span>
              <select
                className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                value={recWeekday}
                onChange={(e) => setRecWeekday(e.target.value)}
              >
                {WEEKDAYS.map((label, index) => (
                  <option key={label} value={index}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : recCadence === "biweekly" || recCadence === "four_weekly" ? (
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
                Next payment date
              </span>
              <input
                className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                type="date"
                value={recAnchor || recDueDate}
                onChange={(e) => {
                  setRecAnchor(e.target.value);
                  setRecDueDate(e.target.value);
                }}
              />
              <span className="block text-xs text-[#6c7771]">
                Pick the next date this payment leaves your account.
              </span>
            </label>
          ) : (
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
                Payment due date
              </span>
              <input
                className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
                type="date"
                value={recDueDate}
                onChange={(e) => {
                  setRecDueDate(e.target.value);
                  const day = Number(e.target.value.slice(8, 10));
                  if (day >= 1 && day <= 28) setRecDay(String(day));
                }}
              />
              <span className="block text-xs text-[#6c7771]">
                {recCadence === "yearly"
                  ? `Repeats each year around day ${recDueDate.slice(8, 10) || recDay}.`
                  : `Repeats on day ${recDueDate.slice(8, 10) || recDay} each month.`}
              </span>
            </label>
          )}
        </div>
        <label className="block space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
            Category
          </span>
          <select
            className="w-full rounded-xl border border-[#dde2dd] px-3 py-3 text-sm"
            value={recCategoryId}
            onChange={(e) => setRecCategoryId(e.target.value)}
          >
            <option value="">Uncategorised</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <span className="block text-xs text-[#6c7771]">
            Same categories as daily expenses — use them to filter and group in
            By category view.
          </span>
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
            Note
          </span>
          <textarea
            className="w-full rounded-xl border border-[#dde2dd] px-3 py-3 text-sm"
            rows={2}
            placeholder="e.g. Paid from joint account / HSBC current"
            value={recNote}
            onChange={(e) => setRecNote(e.target.value)}
          />
        </label>
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
