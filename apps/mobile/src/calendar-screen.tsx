import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  formatMoney,
  getCalendar,
  type CalendarEvent,
  type CalendarPayload,
} from './api';

const colors = {
  ink: '#14241F',
  canvas: '#F4F5F0',
  paper: '#FFFFFF',
  line: '#DDE2DD',
  muted: '#6C7771',
  sage: '#DBE8D7',
  sageDeep: '#617A57',
  acid: '#D6F57A',
  dangerSoft: '#F8E4DF',
  danger: '#8A3D30',
};

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftWeek(start: string, delta: number): string {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta * 7);
  return date.toISOString().slice(0, 10);
}

function eventStyle(type: CalendarEvent['type']) {
  if (type === 'payment') return styles.eventPayment;
  if (type === 'payday') return styles.eventPayday;
  return styles.eventTask;
}

export function CalendarScreen({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const now = useMemo(() => new Date(), []);
  const [view, setView] = useState<'week' | 'month'>('month');
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [weekStart, setWeekStart] = useState(isoToday());
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>(['task', 'payment', 'payday']);
  const [data, setData] = useState<CalendarPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getCalendar({
        view,
        year,
        month,
        start: weekStart,
        areaIds,
        types,
      });
      setData(next);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not load calendar');
    } finally {
      setLoading(false);
    }
  }, [view, year, month, weekStart, areaIds, types, notify]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleArea(id: string) {
    setAreaIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  }

  function toggleType(type: string) {
    setTypes((prev) => {
      if (prev.includes(type)) {
        const next = prev.filter((value) => value !== type);
        return next.length ? next : prev;
      }
      return [...prev, type];
    });
  }

  function shiftMonth(delta: number) {
    const date = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(date.getUTCFullYear());
    setMonth(date.getUTCMonth() + 1);
  }

  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleString(
    'en-GB',
    { month: 'long', year: 'numeric', timeZone: 'UTC' },
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.title}>Calendar</Text>
        <Text style={styles.sub}>Tasks, payments, and paydays together.</Text>

        <View style={styles.row}>
          {(['week', 'month'] as const).map((id) => (
            <Pressable
              key={id}
              onPress={() => setView(id)}
              style={[styles.chip, view === id && styles.chipActive]}
            >
              <Text style={[styles.chipText, view === id && styles.chipTextActive]}>
                {id === 'week' ? 'Week' : 'Month'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row}>
          {view === 'month' ? (
            <>
              <Pressable style={styles.navBtn} onPress={() => shiftMonth(-1)}>
                <Text style={styles.navText}>Prev</Text>
              </Pressable>
              <Text style={styles.range}>{monthLabel}</Text>
              <Pressable style={styles.navBtn} onPress={() => shiftMonth(1)}>
                <Text style={styles.navText}>Next</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                style={styles.navBtn}
                onPress={() => setWeekStart((value) => shiftWeek(value, -1))}
              >
                <Text style={styles.navText}>Prev</Text>
              </Pressable>
              <Text style={styles.range}>
                {data ? `${data.rangeStart.slice(5)} → ${data.rangeEnd.slice(5)}` : 'Week'}
              </Text>
              <Pressable
                style={styles.navBtn}
                onPress={() => setWeekStart((value) => shiftWeek(value, 1))}
              >
                <Text style={styles.navText}>Next</Text>
              </Pressable>
            </>
          )}
        </View>

        <View style={styles.rowWrap}>
          {(['task', 'payment', 'payday'] as const).map((type) => (
            <Pressable
              key={type}
              onPress={() => toggleType(type)}
              style={[styles.chip, types.includes(type) && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  types.includes(type) && styles.chipTextActive,
                ]}
              >
                {type === 'task' ? 'Tasks' : type === 'payment' ? 'Payments' : 'Paydays'}
              </Text>
            </Pressable>
          ))}
        </View>

        {data?.areas.length ? (
          <View style={styles.rowWrap}>
            <Pressable
              onPress={() => setAreaIds([])}
              style={[styles.chip, areaIds.length === 0 && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  areaIds.length === 0 && styles.chipTextActive,
                ]}
              >
                All areas
              </Text>
            </Pressable>
            {data.areas.map((area) => (
              <Pressable
                key={area.id}
                onPress={() => toggleArea(area.id)}
                style={[styles.chip, areaIds.includes(area.id) && styles.chipActive]}
              >
                <Text
                  style={[
                    styles.chipText,
                    areaIds.includes(area.id) && styles.chipTextActive,
                  ]}
                >
                  {area.title}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {data ? (
          <Text style={styles.counts}>
            {data.counts.tasks} tasks · {data.counts.payments} payments ·{' '}
            {data.counts.paydays} paydays
          </Text>
        ) : null}
      </View>

      {loading ? <Text style={styles.sub}>Loading calendar…</Text> : null}

      {!loading && data
        ? data.days.map((day) => (
            <View key={day.date} style={styles.dayCard}>
              <Text style={styles.dayLabel}>
                {day.weekday} · {day.date}
              </Text>
              {day.events.length === 0 ? (
                <Text style={styles.empty}>No events</Text>
              ) : (
                day.events.map((event) => (
                  <View key={event.id} style={[styles.event, eventStyle(event.type)]}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    {event.amountCents != null ? (
                      <Text style={styles.eventMeta}>{formatMoney(event.amountCents)}</Text>
                    ) : null}
                    {event.areaTitle ? (
                      <Text style={styles.eventMeta}>{event.areaTitle}</Text>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, paddingBottom: 24 },
  card: {
    backgroundColor: colors.paper,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 10,
  },
  title: { fontSize: 24, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 13, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.canvas,
  },
  chipActive: { backgroundColor: colors.ink },
  chipText: { fontSize: 11, fontWeight: '700', color: colors.muted },
  chipTextActive: { color: colors.acid },
  navBtn: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  navText: { fontSize: 11, fontWeight: '700', color: colors.ink },
  range: { flex: 1, textAlign: 'center', fontWeight: '700', color: colors.ink },
  counts: { fontSize: 11, color: colors.muted },
  dayCard: {
    backgroundColor: colors.paper,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    gap: 8,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.sageDeep,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  empty: { fontSize: 12, color: colors.muted },
  event: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  eventTask: { backgroundColor: colors.canvas },
  eventPayment: { backgroundColor: colors.dangerSoft },
  eventPayday: { backgroundColor: colors.sage },
  eventTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  eventMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
});
