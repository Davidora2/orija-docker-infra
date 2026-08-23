import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Rect, Text as SvgText } from 'react-native-svg';
import {
  formatMoney,
  getCashflowSeries,
  getMonthOutgoings,
  type Budget,
  type CashflowSeries,
  type HouseholdMoneyLens,
  type MonthOutgoings,
} from './api';
import { CapacityRing } from './capacity-ring';
import { LifeIcon } from './life-icon';
import {
  AcidButtonLabel,
  AppButton,
  FocusHero,
  SurfaceCard,
} from './ui';
import { colors, serif } from './ui/theme';

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

type Props = {
  currency: string;
  budget?: Budget | null;
  householdLens?: HouseholdMoneyLens | null;
  onNavigate: (section: 'outgoings' | 'wealth') => void;
  notify: (message: string) => void;
};

function isoToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${date}T12:00:00`));
}

export function DashboardView({
  currency,
  budget,
  householdLens,
  onNavigate,
  notify,
}: Props) {
  const [data, setData] = useState<CashflowSeries | null>(null);
  const [month, setMonth] = useState<MonthOutgoings | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const isHousehold = Boolean(householdLens);

  const load = useCallback(async () => {
    setStatus('loading');
    const now = new Date();
    try {
      if (householdLens) {
        setMonth({
          budgetId: '',
          year: householdLens.year,
          month: householdLens.month,
          currency: householdLens.currency,
          paySchedule: {
            frequency: null,
            nextPayDate: null,
            typicalPayCents: householdLens.totals.expectedPayCents ?? null,
            payDates: [],
          },
          days: [],
          list: householdLens.list,
          totals: householdLens.totals,
          recommendations: [],
        });
        setData(null);
        setStatus('ready');
        return;
      }
      if (!budget) {
        setMonth(null);
        setData(null);
        setStatus('ready');
        return;
      }
      const [nextSeries, nextMonth] = await Promise.all([
        getCashflowSeries(budget.id, 6),
        getMonthOutgoings(budget.id, now.getFullYear(), now.getMonth() + 1),
      ]);
      setData(nextSeries);
      setMonth(nextMonth);
      setStatus('ready');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not load money overview.');
      setStatus('error');
    }
  }, [budget, householdLens, notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const plannedCents =
    budget?.summary?.plannedCents ??
    (budget?.categories ?? []).reduce(
      (total, category) => total + category.plannedCents,
      0,
    ) ??
    0;
  const monthOutgoingsCents = month?.totals.expenseCents ?? 0;
  const projectedExpenseCents =
    month?.totals.projectedExpenseCents ?? month?.totals.recurringCents ?? 0;
  const actualExpenseCents =
    month?.totals.actualExpenseCents ?? month?.totals.dailyExpenseCents ?? 0;
  const recurringMonthlyCents = month?.totals.recurringCents ?? 0;
  const oneOffCents = month?.totals.dailyExpenseCents ?? month?.totals.oneOffCents ?? 0;
  const savingCents = month?.totals.savingContributionCents ?? 0;
  const debtCents = month?.totals.debtPaymentCents ?? 0;
  const hasCategoryPlan = !isHousehold && plannedCents > 0;
  const hasOutgoings = monthOutgoingsCents > 0;
  const recordedIncomeCents = month?.totals.incomeCents ?? 0;
  const expectedPayCents = month?.totals.expectedPayCents ?? null;
  const hasCashflowBasis = expectedPayCents != null || recordedIncomeCents > 0;
  const cashflowInCents = expectedPayCents ?? recordedIncomeCents;
  const cashflowDeltaCents = cashflowInCents - projectedExpenseCents;
  const topCue =
    month?.recommendations.find((item) => item.flagged) ??
    month?.recommendations[0] ??
    null;
  const today = isoToday();
  const displayCurrency = month?.currency ?? currency;

  const maxValue = useMemo(() => {
    if (!data?.series.length) return 1;
    return Math.max(
      1,
      ...data.series.flatMap((point) => [
        point.incomeCents > 0 ? point.incomeCents : point.expectedIncomeCents,
        point.projectedExpenseCents ?? point.expenseCents,
        point.actualExpenseCents ?? 0,
      ]),
    );
  }, [data]);

  const hasActualCashflow = useMemo(
    () =>
      (data?.series ?? []).some(
        (point) => (point.actualExpenseCents ?? 0) > 0,
      ),
    [data],
  );

  const chartUsesExpectedIncome = useMemo(
    () =>
      (data?.series ?? []).some(
        (point) => point.incomeCents <= 0 && point.expectedIncomeCents > 0,
      ),
    [data],
  );

  const upcoming = useMemo(() => {
    if (!month) return [];
    const bills = month.list
      .filter(
        (item) =>
          item.kind === 'EXPENSE' &&
          item.source !== 'entry' &&
          item.date >= today,
      )
      .map((item) => ({
        id: item.id,
        date: item.date,
        title: item.title,
        detail: item.paid ? 'Paid' : 'Scheduled outgoing',
        amountCents: item.amountCents,
        kind: 'bill' as const,
      }));
    const paydays = month.paySchedule.payDates
      .filter((date) => date >= today)
      .map((date) => ({
        id: `payday-${date}`,
        date,
        title: 'Payday',
        detail:
          month.paySchedule.typicalPayCents != null
            ? 'Typical pay'
            : 'Payday marker',
        amountCents: month.paySchedule.typicalPayCents,
        kind: 'payday' as const,
      }));
    return [...bills, ...paydays]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 4);
  }, [month, today]);

  if (status === 'loading') {
    return (
      <SurfaceCard>
        <Text style={styles.loading}>Loading money overview…</Text>
      </SurfaceCard>
    );
  }

  if (status === 'error') {
    return (
      <SurfaceCard>
        <Text style={styles.errorTitle}>Money overview is unavailable</Text>
        <AppButton onPress={() => void load()} variant="secondary">
          Try again
        </AppButton>
      </SurfaceCard>
    );
  }

  return (
    <View style={styles.stack}>
      <FocusHero
        accentDot
        eyebrow={
          isHousehold
            ? 'Household overview'
            : `${MONTH_SHORT[(month?.month ?? 1) - 1]} ${month?.year} pulse`
        }
        title={
          isHousehold
            ? formatMoney(monthOutgoingsCents, displayCurrency)
            : hasCashflowBasis
              ? `${formatMoney(Math.abs(cashflowDeltaCents), displayCurrency)} ${
                  cashflowDeltaCents >= 0 ? 'expected to remain' : 'more going out'
                }`
              : formatMoney(monthOutgoingsCents, displayCurrency)
        }
        subtitle={
          isHousehold
            ? 'Combined household outgoings this month'
            : hasCashflowBasis
              ? undefined
              : 'Balance this month'
        }
        meta={
          isHousehold
            ? householdLens?.emptySharedOnly
              ? 'No household bills yet. Move a bill from Personal.'
              : 'Household spending across shared bills'
            : expectedPayCents != null
              ? `${formatMoney(expectedPayCents, displayCurrency)} expected pay minus ${formatMoney(
                  projectedExpenseCents,
                  displayCurrency,
                )} projected (${formatMoney(actualExpenseCents, displayCurrency)} logged).`
              : recordedIncomeCents > 0
                ? `${formatMoney(recordedIncomeCents, displayCurrency)} income minus ${formatMoney(
                    projectedExpenseCents,
                    displayCurrency,
                  )} projected (${formatMoney(actualExpenseCents, displayCurrency)} logged).`
                : `${formatMoney(projectedExpenseCents, displayCurrency)} projected from scheduled bills. Mark paid to build actual history.`
        }
        actions={
          <>
            <AppButton onPress={() => onNavigate('outgoings')} variant="acid">
              <AcidButtonLabel>Review spending</AcidButtonLabel>
            </AppButton>
            <AppButton onPress={() => onNavigate('wealth')} variant="outlineDark">
              Open wealth
            </AppButton>
          </>
        }
      >
        {topCue && !isHousehold ? (
          <View style={styles.cue}>
            <Text style={styles.cueTitle}>{topCue.title}</Text>
            <Text style={styles.cueDetail}>{topCue.detail}</Text>
          </View>
        ) : null}
      </FocusHero>

      <SurfaceCard>
        <View style={styles.planRow}>
          <View style={styles.planCopy}>
            <Text style={styles.eyebrow}>Plan vs month total</Text>
            <Text style={styles.cardTitle}>
              {hasCategoryPlan
                ? formatMoney(
                    Math.abs(plannedCents - monthOutgoingsCents),
                    displayCurrency,
                  )
                : hasOutgoings
                  ? formatMoney(monthOutgoingsCents, displayCurrency)
                  : 'No outgoings yet'}
            </Text>
            <Text style={styles.meta}>
              {hasCategoryPlan
                ? `${monthOutgoingsCents <= plannedCents ? 'Under' : 'Over'} the category plan`
                : hasOutgoings
                  ? `${formatMoney(recurringMonthlyCents, displayCurrency)} from regular bills this month`
                  : 'Add recurring bills or category amounts in Spending'}
            </Text>
          </View>
          <CapacityRing
            used={
              hasCategoryPlan
                ? monthOutgoingsCents / 100
                : recurringMonthlyCents / 100
            }
            capacity={
              hasCategoryPlan ? plannedCents / 100 : monthOutgoingsCents / 100
            }
            size={92}
            label={
              hasCategoryPlan
                ? 'Monthly outgoings against category plan'
                : 'Regular bills share of month outgoings'
            }
          />
        </View>
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Category plan</Text>
            <Text style={styles.statValue}>
              {formatMoney(isHousehold ? 0 : plannedCents, displayCurrency)}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Projected</Text>
            <Text style={styles.statValue}>
              {formatMoney(projectedExpenseCents, displayCurrency)}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Actual logged</Text>
            <Text style={styles.statValue}>
              {formatMoney(actualExpenseCents, displayCurrency)}
            </Text>
          </View>
        </View>
        <Text style={styles.footnote}>
          {hasCategoryPlan
            ? 'Category plan is your target. Projected is scheduled bills; actual is logged spending and confirmed payments.'
            : hasOutgoings
              ? `Projected includes ${formatMoney(recurringMonthlyCents, displayCurrency)} regular bills${
                  savingCents > 0
                    ? `, ${formatMoney(savingCents, displayCurrency)} savings`
                    : ''
                }${
                  debtCents > 0
                    ? `, ${formatMoney(debtCents, displayCurrency)} debt payments`
                    : ''
                }. Actual is what you logged or marked paid.`
              : 'Add recurring bills or category amounts in Spending.'}
        </Text>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.comingHeader}>
          <View>
            <Text style={styles.eyebrow}>Coming up</Text>
            <Text style={styles.cardTitle}>Bills & payday</Text>
          </View>
          <LifeIcon color={colors.sageDeep} name="calendar" size={24} />
        </View>
        {upcoming.length > 0 ? (
          upcoming.map((item) => (
            <View key={item.id} style={styles.upcomingRow}>
              <View
                style={[
                  styles.dateBadge,
                  item.kind === 'payday' ? styles.dateBadgePay : styles.dateBadgeBill,
                ]}
              >
                <Text
                  style={[
                    styles.dateBadgeText,
                    item.kind === 'payday'
                      ? styles.dateBadgeTextPay
                      : styles.dateBadgeTextBill,
                  ]}
                >
                  {formatDate(item.date)}
                </Text>
              </View>
              <View style={styles.upcomingCopy}>
                <Text numberOfLines={1} style={styles.upcomingTitle}>
                  {item.title}
                </Text>
                <Text style={styles.upcomingDetail}>{item.detail}</Text>
              </View>
              {item.amountCents != null ? (
                <Text style={styles.upcomingAmount}>
                  {item.kind === 'bill' ? '−' : ''}
                  {formatMoney(item.amountCents, displayCurrency)}
                </Text>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={styles.meta}>
            Nothing else scheduled. Add recurring bills or a payday in Spending.
          </Text>
        )}
      </SurfaceCard>

      {!isHousehold && data?.series.length ? (
        <SurfaceCard>
          <Text style={styles.eyebrow}>Recent cashflow</Text>
          <Text style={styles.cardTitle}>Six-month context</Text>
          <Text style={styles.meta}>
            {chartUsesExpectedIncome
              ? 'Expected pay with projected (light) and actual (solid) outgoings.'
              : 'Income with projected (light) and actual (solid) outgoings.'}
          </Text>
          {hasActualCashflow ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <CashflowBarChart
                currency={displayCurrency}
                maxValue={maxValue}
                series={data.series}
                usesExpectedIncome={chartUsesExpectedIncome}
              />
            </ScrollView>
          ) : (
            <Text style={styles.meta}>
              Mark bills paid in Spending to build your actual cashflow history.
            </Text>
          )}
        </SurfaceCard>
      ) : isHousehold ? (
        <SurfaceCard>
          <Text style={styles.meta}>
            Six-month cashflow history is available in your personal overview.
          </Text>
        </SurfaceCard>
      ) : null}
    </View>
  );
}

function CashflowBarChart({
  series,
  maxValue,
  currency,
  usesExpectedIncome,
}: {
  series: CashflowSeries['series'];
  maxValue: number;
  currency: string;
  usesExpectedIncome: boolean;
}) {
  const width = Math.max(320, series.length * 72);
  const height = 180;
  const pad = 24;
  const groupWidth = (width - pad * 2) / Math.max(series.length, 1);
  const barWidth = Math.max(6, (groupWidth - 8) / 3);

  return (
    <View>
      <Svg height={height} width={width}>
        {series.map((point, index) => {
          const x0 = pad + index * groupWidth;
          const incomeValue =
            point.incomeCents > 0 ? point.incomeCents : point.expectedIncomeCents;
          const projectedValue =
            point.projectedExpenseCents ?? point.expenseCents;
          const bars = [
            { value: incomeValue, color: '#617A57' },
            { value: projectedValue, color: '#E8C4B8' },
            { value: point.actualExpenseCents ?? 0, color: '#D88B77' },
          ];
          return (
            <G key={point.label}>
              {bars.map((bar, barIndex) => {
                const barHeight =
                  maxValue > 0 ? (bar.value / maxValue) * (height - pad * 2) : 0;
                const x = x0 + barIndex * barWidth;
                const y = height - pad - barHeight;
                return (
                  <Rect
                    key={`${point.label}-${barIndex}`}
                    fill={bar.color}
                    height={Math.max(barHeight, 0)}
                    rx={3}
                    width={barWidth - 2}
                    x={x}
                    y={y}
                  />
                );
              })}
              <SvgText
                fill={colors.muted}
                fontSize={10}
                textAnchor="middle"
                x={x0 + groupWidth / 2}
                y={height - 6}
              >
                {MONTH_SHORT[point.month - 1]}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: '#617A57' }]} />
          <Text style={styles.legendText}>
            {usesExpectedIncome ? 'Expected pay' : 'Income'}
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: '#E8C4B8' }]} />
          <Text style={styles.legendText}>Projected</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: '#D88B77' }]} />
          <Text style={styles.legendText}>Actual</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  loading: { color: colors.muted, fontSize: 14 },
  errorTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  eyebrow: {
    color: colors.sageDeep,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: serif,
    fontSize: 24,
    fontWeight: '700',
    marginTop: 4,
  },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  cue: {
    borderLeftColor: colors.acid,
    borderLeftWidth: 2,
    marginTop: 12,
    paddingLeft: 10,
  },
  cueTitle: { color: colors.paper, fontSize: 12, fontWeight: '700' },
  cueDetail: { color: '#AEBDB6', fontSize: 12, lineHeight: 18, marginTop: 4 },
  planRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  planCopy: { flex: 1 },
  statRow: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    paddingTop: 14,
  },
  stat: { flex: 1 },
  statLabel: {
    color: '#87918C',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  statValue: { color: colors.ink, fontSize: 14, fontWeight: '700', marginTop: 4 },
  footnote: { color: '#87918C', fontSize: 11, lineHeight: 16, marginTop: 10 },
  comingHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  upcomingRow: {
    alignItems: 'center',
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
  },
  dateBadge: {
    alignItems: 'center',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  dateBadgeBill: { backgroundColor: '#F7EEE8' },
  dateBadgePay: { backgroundColor: '#DBE8D7' },
  dateBadgeText: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  dateBadgeTextBill: { color: '#9A503E' },
  dateBadgeTextPay: { color: '#36572B' },
  upcomingCopy: { flex: 1 },
  upcomingTitle: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  upcomingDetail: { color: '#87918C', fontSize: 12, marginTop: 2 },
  upcomingAmount: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  legendRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  legendSwatch: { borderRadius: 2, height: 10, width: 10 },
  legendText: { color: colors.muted, fontSize: 12 },
});
