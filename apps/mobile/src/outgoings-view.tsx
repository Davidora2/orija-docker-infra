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
  createRecurringOutgoing,
  currencySymbol,
  deleteRecurringOutgoing,
  formatMoney,
  getMonthOutgoings,
  listRecurringOutgoings,
  markOutgoingPaid,
  unmarkOutgoingPaid,
  updateBudget,
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
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
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
  const displayCurrency =
    preferredCurrency || data?.currency || budget.currency || 'GBP';
  const symbol = currencySymbol(displayCurrency);

  useEffect(() => {
    setPayFrequency(budget.payFrequency ?? 'monthly');
    setNextPayDate(budget.nextPayDate ?? '');
    setTypicalPay(
      budget.typicalPayCents != null ? String(budget.typicalPayCents / 100) : '',
    );
  }, [budget.id, budget.payFrequency, budget.nextPayDate, budget.typicalPayCents]);

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
      });
      setRecName('');
      setRecAmount('');
      setRecAnchor('');
      setRecNote('');
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
    if (item.source !== 'recurring' && item.source !== 'saving') return;
    setBusy(true);
    try {
      if (item.paid && item.paymentId) {
        await unmarkOutgoingPaid(budget.id, item.paymentId);
      } else {
        const sourceId =
          item.source === 'recurring' ? item.recurringId : item.savingGoalId;
        if (!sourceId) throw new Error('Missing payment source.');
        await markOutgoingPaid(budget.id, {
          sourceType:
            item.source === 'recurring' ? 'recurring_outgoing' : 'saving_goal',
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
    return 'Logged';
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
        </View>
        {data ? (
          <Text style={styles.meta}>
            {formatMoney(data.totals.expenseCents, displayCurrency)} out this month
            {data.totals.outstandingCents != null
              ? ` · ${formatMoney(data.totals.outstandingCents, displayCurrency)} outstanding`
              : ''}
          </Text>
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
                    {(item.source === 'recurring' || item.source === 'saving') && (
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
          {data.list.length === 0 ? (
            <Text style={styles.meta}>No outgoings this month.</Text>
          ) : (
            data.list.map((item) => (
              <View key={item.id} style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.meta}>
                    {item.date} · {sourceLabel(item)}
                    {item.paid
                      ? ' · paid'
                      : item.source !== 'entry'
                        ? ' · outstanding'
                        : ''}
                  </Text>
                </View>
                {(item.source === 'recurring' || item.source === 'saving') && (
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
