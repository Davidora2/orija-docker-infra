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
  formatMoney,
  getMonthOutgoings,
  updateBudget,
  type Budget,
  type MonthOutgoings,
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
  notify: (message: string) => void;
  onChanged: () => void;
};

export function OutgoingsView({ budget, notify, onChanged }: Props) {
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
  const displayCurrency = data?.currency || budget.currency || 'GBP';
  const symbol = currencySymbol(displayCurrency);

  useEffect(() => {
    setPayFrequency(budget.payFrequency ?? 'monthly');
    setNextPayDate(budget.nextPayDate ?? '');
    setTypicalPay(
      budget.typicalPayCents != null ? String(budget.typicalPayCents / 100) : '',
    );
  }, [budget.id, budget.payFrequency, budget.nextPayDate, budget.typicalPayCents, budget.currency]);

  const load = useCallback(async () => {
    const next = await getMonthOutgoings(budget.id, year, month);
    setData(next);
  }, [budget.id, year, month]);

  useEffect(() => {
    void load().catch((error) =>
      notify(error instanceof Error ? error.message : 'Could not load outgoings.'),
    );
  }, [load, notify]);

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
    setBusy(true);
    try {
      await createRecurringOutgoing(budget.id, {
        name: recName.trim(),
        amountCents: Math.round(pounds * 100),
        cadence: 'monthly',
        dayOfMonth: Number(recDay) || 1,
      });
      setRecName('');
      setRecAmount('');
      await load();
      onChanged();
      notify('Recurring outgoing added.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not add recurring.');
    } finally {
      setBusy(false);
    }
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
            {formatMoney(data.totals.expenseCents, data.currency)} out this month
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
                        {item.source === 'recurring' ? 'Recurring' : 'Logged'}
                      </Text>
                    </View>
                    <Text style={styles.expense}>
                      -{formatMoney(item.amountCents, data.currency)}
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
                    {item.date} · {item.source === 'recurring' ? 'Recurring' : 'Logged'}
                  </Text>
                </View>
                <Text style={styles.expense}>
                  -{formatMoney(item.amountCents, data.currency)}
                </Text>
              </View>
            ))
          )}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Add monthly recurring</Text>
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
        <TextInput
          style={styles.input}
          placeholder="Day of month (1-28)"
          placeholderTextColor="#9BA49E"
          keyboardType="number-pad"
          value={recDay}
          onChangeText={setRecDay}
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
