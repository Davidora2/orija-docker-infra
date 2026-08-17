import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
} from './api';

const colors = {
  ink: '#14241F',
  paper: '#FFFFFF',
  line: '#DDE2DD',
  muted: '#6C7771',
  sage: '#DBE8D7',
  sageDeep: '#617A57',
  acid: '#D6F57A',
  danger: '#C9634F',
  canvas: '#F4F5F0',
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

type Props = {
  budget: Budget;
  preferredCurrency?: string;
  notify: (message: string) => void;
  onChanged: () => void;
};

export function OutgoingsView({
  budget,
  preferredCurrency,
  notify,
  onChanged,
}: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [view, setView] = useState<'calendar' | 'list' | 'category'>('calendar');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [data, setData] = useState<MonthOutgoings | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [payFrequency, setPayFrequency] = useState(budget.payFrequency ?? 'monthly');
  const [nextPayDate, setNextPayDate] = useState(budget.nextPayDate ?? '');
  const [typicalPay, setTypicalPay] = useState(
    budget.typicalPayCents != null ? String(budget.typicalPayCents / 100) : '',
  );
  const [recName, setRecName] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recDay, setRecDay] = useState('1');
  const [recCadence, setRecCadence] = useState<
    'weekly' | 'biweekly' | 'four_weekly' | 'monthly' | 'yearly'
  >('monthly');
  const [recWeekday, setRecWeekday] = useState('1');
  const [recAnchor, setRecAnchor] = useState('');
  const [recNote, setRecNote] = useState('');
  const [recCategoryId, setRecCategoryId] = useState('');
  const [recDueDate, setRecDueDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [recurringRows, setRecurringRows] = useState<RecurringOutgoing[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editWeekday, setEditWeekday] = useState('1');
  const [editDate, setEditDate] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [dailyAmount, setDailyAmount] = useState('');
  const [dailyNote, setDailyNote] = useState('');
  const [dailyCategoryId, setDailyCategoryId] = useState<string | null>(null);
  const [dailyDate, setDailyDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categories, setCategories] = useState(budget.categories ?? []);
  const displayCurrency =
    preferredCurrency || data?.currency || budget.currency || 'GBP';
  const symbol = currencySymbol(displayCurrency);

  useEffect(() => {
    setPayFrequency(budget.payFrequency ?? 'monthly');
    setNextPayDate(budget.nextPayDate ?? '');
    setTypicalPay(
      budget.typicalPayCents != null ? String(budget.typicalPayCents / 100) : '',
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
  }, [budget.id, year, month]);

  useEffect(() => {
    void load().catch((error) =>
      notify(error instanceof Error ? error.message : 'Could not load outgoings.'),
    );
  }, [load, notify, budget.currency, preferredCurrency]);

  const firstWeekday = useMemo(
    () => new Date(Date.UTC(year, month - 1, 1)).getUTCDay(),
    [year, month],
  );
  const selectedDay = data?.days.find((day) => day.date === selectedDate) ?? null;

  function matchesCategoryFilter(item: { categoryId: string | null }) {
    if (categoryFilter === 'all') return true;
    if (categoryFilter === 'uncategorised') return !item.categoryId;
    return item.categoryId === categoryFilter;
  }

  const filteredList = useMemo(() => {
    if (!data) return [];
    return data.list.filter(matchesCategoryFilter);
  }, [data, categoryFilter]);

  const categoryGroups = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; label: string; totalCents: number; items: OutgoingItem[] }
    >();
    for (const item of filteredList) {
      const key = item.categoryId ?? 'uncategorised';
      const label =
        item.categoryName ??
        categories.find((category) => category.id === item.categoryId)?.name ??
        'Uncategorised';
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

  function categoryLabel(categoryId: string | null | undefined) {
    if (!categoryId) return 'Uncategorised';
    return (
      categories.find((category) => category.id === categoryId)?.name ??
      'Uncategorised'
    );
  }

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
      notify('Pay schedule saved.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save pay schedule.');
    } finally {
      setBusy(false);
    }
  }

  async function addDailyExpense() {
    const pounds = Number(dailyAmount);
    if (!Number.isFinite(pounds) || pounds <= 0) {
      notify('Enter a positive amount for the daily expense.');
      return;
    }
    setBusy(true);
    try {
      await addBudgetEntry(budget.id, {
        kind: 'EXPENSE',
        amountCents: Math.round(pounds * 100),
        categoryId: dailyCategoryId,
        note: dailyNote.trim(),
        occurredOn: dailyDate || undefined,
      });
      setDailyAmount('');
      setDailyNote('');
      await load();
      onChanged();
      notify('Daily expense added to this month.');
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not save daily expense.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function addCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      notify('Enter a category name.');
      return;
    }
    setBusy(true);
    try {
      const created = await createBudgetCategory(budget.id, { name });
      setCategories((prev) => [...prev, created]);
      setDailyCategoryId(created.id);
      setNewCategoryName('');
      onChanged();
      notify('Category added.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not add category.');
    } finally {
      setBusy(false);
    }
  }

  async function changeEntryCategory(entryId: string, categoryId: string | null) {
    setBusy(true);
    try {
      await updateBudgetEntry(budget.id, entryId, { categoryId });
      await load();
      onChanged();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not update category.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function addRecurring() {
    const pounds = Number(recAmount);
    if (!recName.trim() || !Number.isFinite(pounds) || pounds <= 0) {
      notify('Add a name and amount.');
      return;
    }
    if (
      (recCadence === 'biweekly' || recCadence === 'four_weekly') &&
      !(recAnchor || recDueDate)
    ) {
      notify('Pick the next payment date for every 2 / 4 week outgoings.');
      return;
    }
    if ((recCadence === 'monthly' || recCadence === 'yearly') && !recDueDate) {
      notify('Pick a payment due date.');
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
          recCadence === 'monthly' || recCadence === 'yearly'
            ? Math.min(Math.max(dueDay || Number(recDay) || 1, 1), 28)
            : null,
        weekday: recCadence === 'weekly' ? Number(recWeekday) : null,
        anchorDate:
          recCadence === 'biweekly' || recCadence === 'four_weekly'
            ? recAnchor || recDueDate
            : null,
        note: recNote.trim() || undefined,
        categoryId: recCategoryId || null,
      });
      setRecName('');
      setRecAmount('');
      setRecAnchor('');
      setRecNote('');
      setRecCategoryId('');
      await load();
      onChanged();
      notify('Recurring outgoing added.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not add recurring.');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(row: RecurringOutgoing) {
    setEditingId(row.id);
    setEditName(row.name);
    setEditAmount(String(row.amountCents / 100));
    setEditNote(row.note ?? '');
    setEditWeekday(String(row.weekday ?? 1));
    setEditCategoryId(row.categoryId ?? '');
    if (row.cadence === 'biweekly' || row.cadence === 'four_weekly') {
      setEditDate(row.anchorDate ?? '');
    } else if (row.dayOfMonth) {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      setEditDate(`${y}-${m}-${String(row.dayOfMonth).padStart(2, '0')}`);
    } else {
      setEditDate('');
    }
  }

  async function saveEdit(row: RecurringOutgoing) {
    const pounds = Number(editAmount);
    if (!editName.trim() || !Number.isFinite(pounds) || pounds <= 0) {
      notify('Name and positive amount are required.');
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
      if (row.cadence === 'weekly') {
        patch.weekday = Number(editWeekday);
      } else if (row.cadence === 'biweekly' || row.cadence === 'four_weekly') {
        if (!editDate) {
          notify('Pick the next payment date.');
          setBusy(false);
          return;
        }
        patch.anchorDate = editDate;
      } else {
        if (!editDate) {
          notify('Pick a payment due date.');
          setBusy(false);
          return;
        }
        patch.dayOfMonth = Math.min(
          Math.max(Number(editDate.slice(8, 10)) || 1, 1),
          28,
        );
      }
      await updateRecurringOutgoing(budget.id, row.id, patch);
      setEditingId(null);
      await load();
      onChanged();
      notify('Recurring bill updated.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update bill.');
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
      notify('Recurring bill removed.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not remove bill.');
    } finally {
      setBusy(false);
    }
  }

  async function togglePaid(item: OutgoingItem) {
    if (
      item.source !== 'recurring' &&
      item.source !== 'saving' &&
      item.source !== 'debt'
    )
      return;
    setBusy(true);
    try {
      if (item.paid && item.paymentId) {
        await unmarkOutgoingPaid(budget.id, item.paymentId);
      } else {
        const sourceId =
          item.source === 'recurring'
            ? item.recurringId
            : item.source === 'saving'
              ? item.savingGoalId
              : item.debtId;
        if (!sourceId) throw new Error('Missing payment source.');
        await markOutgoingPaid(budget.id, {
          sourceType:
            item.source === 'recurring'
              ? 'recurring_outgoing'
              : item.source === 'saving'
                ? 'saving_goal'
                : 'debt',
          sourceId,
          dueDate: item.date,
        });
      }
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update payment.');
    } finally {
      setBusy(false);
    }
  }

  function sourceLabel(item: OutgoingItem) {
    if (item.source === 'recurring') return 'Bill';
    if (item.source === 'saving') return 'Savings';
    if (item.source === 'debt') return 'Debt';
    return 'Daily';
  }

  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Monthly outgoings</Text>
        <Text style={styles.title}>
          {MONTH_NAMES[month - 1]} {year}
        </Text>
        <View style={styles.row}>
          <Pressable style={styles.chip} onPress={() => shiftMonth(-1)}>
            <Text style={styles.chipText}>Prev</Text>
          </Pressable>
          <Pressable style={styles.chip} onPress={() => shiftMonth(1)}>
            <Text style={styles.chipText}>Next</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, view === 'calendar' && styles.chipActive]}
            onPress={() => setView('calendar')}
          >
            <Text style={[styles.chipText, view === 'calendar' && styles.chipTextActive]}>
              Calendar
            </Text>
          </Pressable>
          <Pressable
            style={[styles.chip, view === 'list' && styles.chipActive]}
            onPress={() => setView('list')}
          >
            <Text style={[styles.chipText, view === 'list' && styles.chipTextActive]}>
              List
            </Text>
          </Pressable>
          <Pressable
            style={[styles.chip, view === 'category' && styles.chipActive]}
            onPress={() => setView('category')}
          >
            <Text
              style={[
                styles.chipText,
                view === 'category' && styles.chipTextActive,
              ]}
            >
              By category
            </Text>
          </Pressable>
        </View>
        {data ? (
          <View style={styles.rowWrap}>
            <Pressable
              style={[styles.chip, categoryFilter === 'all' && styles.chipActive]}
              onPress={() => setCategoryFilter('all')}
            >
              <Text
                style={[
                  styles.chipText,
                  categoryFilter === 'all' && styles.chipTextActive,
                ]}
              >
                All
              </Text>
            </Pressable>
            {categories.map((category) => (
              <Pressable
                key={category.id}
                style={[
                  styles.chip,
                  categoryFilter === category.id && styles.chipActive,
                ]}
                onPress={() => setCategoryFilter(category.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    categoryFilter === category.id && styles.chipTextActive,
                  ]}
                >
                  {category.name}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={[
                styles.chip,
                categoryFilter === 'uncategorised' && styles.chipActive,
              ]}
              onPress={() => setCategoryFilter('uncategorised')}
            >
              <Text
                style={[
                  styles.chipText,
                  categoryFilter === 'uncategorised' && styles.chipTextActive,
                ]}
              >
                Uncategorised
              </Text>
            </Pressable>
          </View>
        ) : null}
        {data ? (
          <View style={{ gap: 4, marginTop: 4 }}>
            <Text style={styles.totalOut}>
              {formatMoney(data.totals.expenseCents, displayCurrency)}
            </Text>
            <Text style={styles.meta}>total out this month</Text>
            <Text style={styles.meta}>
              {formatMoney(data.totals.recurringCents, displayCurrency)} bills ·{' '}
              {formatMoney(
                data.totals.dailyExpenseCents ?? data.totals.oneOffCents,
                displayCurrency,
              )}{' '}
              daily
              {data.totals.outstandingCents != null
                ? ` · ${formatMoney(data.totals.outstandingCents, displayCurrency)} outstanding`
                : ''}
            </Text>
            {data.totals.expectedPayCents != null &&
            data.totals.deltaCents != null ? (
              <Text
                style={{
                  color:
                    data.totals.deltaCents >= 0 ? colors.sageDeep : colors.danger,
                  fontWeight: '700',
                  fontSize: 12,
                }}
              >
                {data.totals.deltaCents >= 0 ? '+' : '−'}
                {formatMoney(Math.abs(data.totals.deltaCents), displayCurrency)}{' '}
                {data.totals.deltaCents >= 0 ? 'left' : 'over'} vs expected pay
              </Text>
            ) : (
              <Text style={styles.meta}>
                Set typical pay to see pay vs outgoings delta.
              </Text>
            )}
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Pay schedule</Text>
        <View style={styles.rowWrap}>
          {(['weekly', 'biweekly', 'monthly'] as const).map((value) => (
            <Pressable
              key={value}
              style={[styles.chip, payFrequency === value && styles.chipActive]}
              onPress={() => setPayFrequency(value)}
            >
              <Text
                style={[
                  styles.chipText,
                  payFrequency === value && styles.chipTextActive,
                ]}
              >
                {value}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder="Next payday YYYY-MM-DD"
          placeholderTextColor="#9BA49E"
          value={nextPayDate}
          onChangeText={setNextPayDate}
        />
        <TextInput
          style={styles.input}
          placeholder={`Typical pay (${symbol})`}
          placeholderTextColor="#9BA49E"
          keyboardType="decimal-pad"
          value={typicalPay}
          onChangeText={setTypicalPay}
        />
        <Pressable
          style={[styles.button, busy && styles.disabled]}
          disabled={busy}
          onPress={() => void savePaySchedule()}
        >
          <Text style={styles.buttonText}>Save pay schedule</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Add daily expense</Text>
        <Text style={styles.meta}>
          One-off spends count toward this month&apos;s total and delta.
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.row}>
            {categories.map((category) => (
              <Pressable
                key={category.id}
                style={[
                  styles.chip,
                  dailyCategoryId === category.id && styles.chipActive,
                ]}
                onPress={() => setDailyCategoryId(category.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    dailyCategoryId === category.id && styles.chipTextActive,
                  ]}
                >
                  {category.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        <TextInput
          style={styles.input}
          placeholder="New category"
          placeholderTextColor="#9BA49E"
          value={newCategoryName}
          onChangeText={setNewCategoryName}
        />
        <Pressable
          style={[styles.buttonSecondary, busy && styles.disabled]}
          disabled={busy}
          onPress={() => void addCategory()}
        >
          <Text style={styles.buttonTextSecondary}>Add category</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder={`Amount (${symbol})`}
          placeholderTextColor="#9BA49E"
          keyboardType="decimal-pad"
          value={dailyAmount}
          onChangeText={setDailyAmount}
        />
        <TextInput
          style={styles.input}
          placeholder="Date YYYY-MM-DD"
          placeholderTextColor="#9BA49E"
          value={dailyDate}
          onChangeText={setDailyDate}
        />
        <TextInput
          style={styles.input}
          placeholder="Note (optional)"
          placeholderTextColor="#9BA49E"
          value={dailyNote}
          onChangeText={setDailyNote}
        />
        <Pressable
          style={[styles.button, busy && styles.disabled]}
          disabled={busy}
          onPress={() => void addDailyExpense()}
        >
          <Text style={styles.buttonText}>Add to this month&apos;s outgoings</Text>
        </Pressable>
      </View>

      {data && view === 'calendar' ? (
        <View style={styles.card}>
          <View style={styles.weekHeader}>
            {WEEKDAYS.map((day, index) => (
              <Text key={`${day}-${index}`} style={styles.weekLabel}>
                {day}
              </Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {Array.from({ length: firstWeekday }).map((_, index) => (
              <View key={`pad-${index}`} style={styles.dayCellEmpty} />
            ))}
            {data.days.map((day) => {
              const active = selectedDate === day.date;
              return (
                <Pressable
                  key={day.date}
                  style={[
                    styles.dayCell,
                    day.isPayDay && styles.dayPay,
                    active && styles.dayActive,
                  ]}
                  onPress={() => setSelectedDate(day.date)}
                >
                  <Text style={[styles.dayNum, active && styles.dayNumActive]}>
                    {Number(day.date.slice(8, 10))}
                  </Text>
                  {day.totalCents > 0 ? (
                    <Text style={[styles.dayAmount, active && styles.dayAmountActive]}>
                      {formatMoney(day.totalCents, displayCurrency).replace(
                        /\.00$/,
                        '',
                      )}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          {selectedDay ? (
            <View style={styles.dayDetail}>
              <Text style={styles.eyebrow}>
                {selectedDay.date}
                {selectedDay.isPayDay ? ' · payday' : ''}
              </Text>
              {selectedDay.items.length === 0 ? (
                <Text style={styles.meta}>No outgoings.</Text>
              ) : (
                selectedDay.items.map((item) => (
                  <View key={item.id} style={styles.listRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      <Text style={styles.meta}>
                        {sourceLabel(item)}
                        {item.paid
                          ? ' · paid'
                          : item.source !== 'entry'
                            ? ' · outstanding'
                            : ''}
                      </Text>
                    </View>
                    {(item.source === 'recurring' ||
                      item.source === 'saving' ||
                      item.source === 'debt') && (
                      <Pressable
                        style={[styles.payChip, item.paid && styles.payChipPaid]}
                        disabled={busy}
                        onPress={() => void togglePaid(item)}
                      >
                        <Text
                          style={[
                            styles.payChipText,
                            item.paid && styles.payChipTextPaid,
                          ]}
                        >
                          {item.paid ? 'Paid' : 'Mark paid'}
                        </Text>
                      </Pressable>
                    )}
                    <Text style={styles.expense}>
                      -{formatMoney(item.amountCents, displayCurrency)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          ) : null}
        </View>
      ) : null}

      {data && view === 'list' ? (
        <View style={styles.card}>
          {filteredList.length === 0 ? (
            <Text style={styles.meta}>
              No outgoings this month
              {categoryFilter !== 'all' ? ' for this category' : ''}.
            </Text>
          ) : (
            filteredList.map((item) => (
              <View key={item.id} style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.meta}>
                    {item.date} · {sourceLabel(item)}
                    {item.categoryName || item.categoryId
                      ? ` · ${item.categoryName ?? categoryLabel(item.categoryId)}`
                      : ''}
                    {item.paid
                      ? ' · paid'
                      : item.source !== 'entry'
                        ? ' · outstanding'
                        : ''}
                  </Text>
                </View>
                {(item.source === 'recurring' ||
                  item.source === 'saving' ||
                  item.source === 'debt') && (
                  <Pressable
                    style={[styles.payChip, item.paid && styles.payChipPaid]}
                    disabled={busy}
                    onPress={() => void togglePaid(item)}
                  >
                    <Text
                      style={[
                        styles.payChipText,
                        item.paid && styles.payChipTextPaid,
                      ]}
                    >
                      {item.paid ? 'Paid' : 'Mark paid'}
                    </Text>
                  </Pressable>
                )}
                <Text style={styles.expense}>
                  -{formatMoney(item.amountCents, displayCurrency)}
                </Text>
              </View>
            ))
          )}
        </View>
      ) : null}

      {data && view === 'category' ? (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>By category</Text>
          {categoryGroups.length === 0 ? (
            <Text style={styles.meta}>Nothing to show for this filter.</Text>
          ) : (
            categoryGroups.map((group) => (
              <View key={group.key} style={{ gap: 6, marginTop: 10 }}>
                <View style={styles.row}>
                  <Text style={[styles.itemTitle, { flex: 1 }]}>{group.label}</Text>
                  <Text style={styles.expense}>
                    {formatMoney(group.totalCents, displayCurrency)}
                  </Text>
                </View>
                {group.items.map((item) => (
                  <Text key={item.id} style={styles.meta}>
                    {item.date} · {item.title} ·{' '}
                    {formatMoney(item.amountCents, displayCurrency)}
                  </Text>
                ))}
              </View>
            ))
          )}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Your recurring bills</Text>
        {recurringRows.length === 0 ? (
          <Text style={styles.meta}>No recurring bills yet.</Text>
        ) : (
          recurringRows.map((row) => (
            <View key={row.id} style={styles.listRow}>
              {editingId === row.id ? (
                <View style={{ flex: 1, gap: 8 }}>
                  <TextInput
                    style={styles.input}
                    value={editName}
                    onChangeText={setEditName}
                    placeholderTextColor="#9BA49E"
                  />
                  <TextInput
                    style={styles.input}
                    value={editAmount}
                    onChangeText={setEditAmount}
                    keyboardType="decimal-pad"
                    placeholderTextColor="#9BA49E"
                  />
                  {row.cadence === 'weekly' ? (
                    <View style={styles.rowWrap}>
                      {WEEKDAYS.map((label, index) => (
                        <Pressable
                          key={`${row.id}-${label}-${index}`}
                          style={[
                            styles.chip,
                            editWeekday === String(index) && styles.chipActive,
                          ]}
                          onPress={() => setEditWeekday(String(index))}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              editWeekday === String(index) &&
                                styles.chipTextActive,
                            ]}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <TextInput
                      style={styles.input}
                      value={editDate}
                      onChangeText={setEditDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#9BA49E"
                      autoCapitalize="none"
                    />
                  )}
                  <TextInput
                    style={styles.input}
                    value={editNote}
                    onChangeText={setEditNote}
                    placeholder="Note — e.g. from joint account"
                    placeholderTextColor="#9BA49E"
                  />
                  <Text style={styles.meta}>Category</Text>
                  <View style={styles.rowWrap}>
                    <Pressable
                      style={[
                        styles.chip,
                        editCategoryId === '' && styles.chipActive,
                      ]}
                      onPress={() => setEditCategoryId('')}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          editCategoryId === '' && styles.chipTextActive,
                        ]}
                      >
                        Uncategorised
                      </Text>
                    </Pressable>
                    {categories.map((category) => (
                      <Pressable
                        key={category.id}
                        style={[
                          styles.chip,
                          editCategoryId === category.id && styles.chipActive,
                        ]}
                        onPress={() => setEditCategoryId(category.id)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            editCategoryId === category.id &&
                              styles.chipTextActive,
                          ]}
                        >
                          {category.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.row}>
                    <Pressable
                      style={styles.button}
                      disabled={busy}
                      onPress={() => void saveEdit(row)}
                    >
                      <Text style={styles.buttonText}>Save</Text>
                    </Pressable>
                    <Pressable
                      style={styles.chip}
                      onPress={() => setEditingId(null)}
                    >
                      <Text style={styles.chipText}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{row.name}</Text>
                    <Text style={styles.meta}>
                      {formatMoney(row.amountCents, displayCurrency)} · {row.cadence}
                      {row.dayOfMonth != null ? ` · day ${row.dayOfMonth}` : ''}
                      {row.anchorDate ? ` · ${row.anchorDate}` : ''}
                      {` · ${categoryLabel(row.categoryId)}`}
                      {row.note ? ` · ${row.note}` : ''}
                    </Text>
                  </View>
                  <Pressable style={styles.chip} onPress={() => startEdit(row)}>
                    <Text style={styles.chipText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={() => void removeRecurring(row)}
                  >
                    <Text style={styles.payChipText}>Remove</Text>
                  </Pressable>
                </>
              )}
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Add recurring</Text>
        <TextInput
          style={styles.input}
          placeholder="Name"
          placeholderTextColor="#9BA49E"
          value={recName}
          onChangeText={setRecName}
        />
        <TextInput
          style={styles.input}
          placeholder={`Amount (${symbol})`}
          placeholderTextColor="#9BA49E"
          keyboardType="decimal-pad"
          value={recAmount}
          onChangeText={setRecAmount}
        />
        <View style={styles.rowWrap}>
          {(
            [
              ['monthly', 'Monthly'],
              ['weekly', 'Weekly'],
              ['biweekly', 'Every 2 weeks'],
              ['four_weekly', 'Every 4 weeks'],
              ['yearly', 'Yearly'],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              style={[styles.chip, recCadence === value && styles.chipActive]}
              onPress={() => setRecCadence(value)}
            >
              <Text
                style={[
                  styles.chipText,
                  recCadence === value && styles.chipTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        {recCadence === 'weekly' ? (
          <>
            <Text style={styles.meta}>Due every</Text>
            <View style={styles.rowWrap}>
              {WEEKDAYS.map((label, index) => (
                <Pressable
                  key={`${label}-${index}`}
                  style={[
                    styles.chip,
                    recWeekday === String(index) && styles.chipActive,
                  ]}
                  onPress={() => setRecWeekday(String(index))}
                >
                  <Text
                    style={[
                      styles.chipText,
                      recWeekday === String(index) && styles.chipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : recCadence === 'biweekly' || recCadence === 'four_weekly' ? (
          <>
            <Text style={styles.meta}>Next payment date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9BA49E"
              value={recAnchor || recDueDate}
              onChangeText={(value) => {
                setRecAnchor(value);
                setRecDueDate(value);
              }}
              autoCapitalize="none"
            />
          </>
        ) : (
          <>
            <Text style={styles.meta}>Payment due date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9BA49E"
              value={recDueDate}
              onChangeText={(value) => {
                setRecDueDate(value);
                const day = Number(value.slice(8, 10));
                if (day >= 1 && day <= 28) setRecDay(String(day));
              }}
              autoCapitalize="none"
            />
          </>
        )}
        <Text style={styles.meta}>Category</Text>
        <View style={styles.rowWrap}>
          <Pressable
            style={[styles.chip, recCategoryId === '' && styles.chipActive]}
            onPress={() => setRecCategoryId('')}
          >
            <Text
              style={[
                styles.chipText,
                recCategoryId === '' && styles.chipTextActive,
              ]}
            >
              Uncategorised
            </Text>
          </Pressable>
          {categories.map((category) => (
            <Pressable
              key={category.id}
              style={[
                styles.chip,
                recCategoryId === category.id && styles.chipActive,
              ]}
              onPress={() => setRecCategoryId(category.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  recCategoryId === category.id && styles.chipTextActive,
                ]}
              >
                {category.name}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.meta}>Note (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Paid from joint account"
          placeholderTextColor="#9BA49E"
          value={recNote}
          onChangeText={setRecNote}
        />
        <Pressable
          style={[styles.button, busy && styles.disabled]}
          disabled={busy}
          onPress={() => void addRecurring()}
        >
          <Text style={styles.buttonText}>Add recurring</Text>
        </Pressable>
      </View>

      {data ? (
        <View style={styles.card}>
          <Text style={styles.title}>Optimise</Text>
          {data.recommendations.map((item) => (
            <View
              key={item.id}
              style={[
                styles.reco,
                item.severity === 'high' && styles.recoHigh,
                item.severity === 'medium' && styles.recoMedium,
              ]}
            >
              <Text style={styles.eyebrow}>{item.severity}</Text>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.meta}>{item.detail}</Text>
              <Text style={styles.action}>{item.action}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  card: {
    backgroundColor: colors.paper,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 8,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.sageDeep,
    textTransform: 'uppercase',
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink },
  totalOut: { fontSize: 26, fontWeight: '700', color: colors.ink },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.paper,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.ink, fontWeight: '600', fontSize: 12 },
  chipTextActive: { color: colors.acid },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.ink,
  },
  button: {
    backgroundColor: colors.ink,
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.paper, fontWeight: '700' },
  buttonSecondary: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonTextSecondary: { color: colors.ink, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  weekHeader: { flexDirection: 'row' },
  weekLabel: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCellEmpty: { width: `${100 / 7}%`, minHeight: 54 },
  dayCell: {
    width: `${100 / 7}%`,
    minHeight: 54,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 4,
    marginBottom: 4,
  },
  dayPay: { backgroundColor: colors.sage, borderColor: colors.sageDeep },
  dayActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  dayNum: { color: colors.ink, fontWeight: '700', fontSize: 11 },
  dayNumActive: { color: colors.paper },
  dayAmount: { color: colors.danger, fontSize: 10, marginTop: 2 },
  dayAmountActive: { color: colors.acid },
  dayDetail: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10, gap: 8 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 8,
  },
  itemTitle: { color: colors.ink, fontWeight: '600' },
  expense: { color: colors.danger, fontWeight: '700' },
  payChip: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#F4E4DF',
  },
  payChipPaid: { backgroundColor: colors.sage },
  payChipText: { color: colors.danger, fontSize: 11, fontWeight: '700' },
  payChipTextPaid: { color: colors.sageDeep },
  reco: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 10,
    gap: 4,
    backgroundColor: colors.canvas,
  },
  recoHigh: { backgroundColor: '#FFF7F5', borderColor: '#EFD4CD' },
  recoMedium: { backgroundColor: '#FFF8EC', borderColor: '#F2E2C4' },
  action: { color: colors.ink, fontWeight: '700', fontSize: 12, marginTop: 4 },
});
