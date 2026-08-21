import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  createBudget,
  formatMoney,
  getBudget,
  listBudgets,
  type Account,
  type Budget,
} from './api';
import { OutgoingsView } from './outgoings-view';
import { WealthView } from './wealth-view';

const colors = {
  ink: '#14241F',
  paper: '#FFFFFF',
  line: '#DDE2DD',
  muted: '#6C7771',
  acid: '#D6F57A',
};

type Props = {
  account: Account;
  notify: (message: string) => void;
};

export function BudgetScreen({ account, notify }: Props) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Budget | null>(null);
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<'overview' | 'outgoings' | 'wealth'>('overview');
  const canShare = (account.members?.length ?? 0) >= 2;
  const currency = account.user.preferredCurrency || 'GBP';

  const reload = useCallback(async () => {
    const list = await listBudgets();
    setBudgets(list);
    const nextId =
      activeId && list.some((budget) => budget.id === activeId)
        ? activeId
        : (list[0]?.id ?? null);
    setActiveId(nextId);
    if (nextId) {
      setDetail(await getBudget(nextId));
    } else {
      setDetail(null);
    }
  }, [activeId]);

  useEffect(() => {
    void reload().catch((error) =>
      notify(error instanceof Error ? error.message : 'Could not load budgets.'),
    );
  }, [reload, notify, account.user.preferredCurrency]);

  async function create(visibility: 'PRIVATE' | 'SHARED') {
    setBusy(true);
    try {
      const created = await createBudget({
        name: visibility === 'SHARED' ? 'Shared budget' : 'Personal budget',
        visibility,
        currency,
      });
      setActiveId(created.id);
      await reload();
      notify(
        visibility === 'SHARED'
          ? 'Shared budget created for your household.'
          : 'Personal budget created.',
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not create budget.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.stack}>
      <Text style={styles.title}>Money</Text>
      <Text style={styles.lede}>
        Calm cashflow pulse — overview, spending, and wealth in one place.
      </Text>

      <View style={styles.row}>
        <Pressable
          style={[styles.button, busy && styles.disabled]}
          disabled={busy}
          onPress={() => void create('PRIVATE')}
        >
          <Text style={styles.buttonText}>+ Personal</Text>
        </Pressable>
        <Pressable
          style={[styles.buttonSecondary, (!canShare || busy) && styles.disabled]}
          disabled={!canShare || busy}
          onPress={() => void create('SHARED')}
        >
          <Text style={styles.buttonTextSecondary}>+ Shared</Text>
        </Pressable>
      </View>
      {!canShare ? (
        <Text style={styles.hint}>
          Link a partner in your profile to create a shared household budget.
        </Text>
      ) : null}

      {budgets.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No budgets yet</Text>
          <Text style={styles.meta}>
            Create a personal budget to track income and spending.
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.tabs}>
            {budgets.map((budget) => (
              <Pressable
                key={budget.id}
                style={[styles.tab, activeId === budget.id && styles.tabActive]}
                onPress={() => {
                  setActiveId(budget.id);
                  void getBudget(budget.id).then(setDetail);
                }}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeId === budget.id && styles.tabTextActive,
                  ]}
                >
                  {budget.name} ·{' '}
                  {budget.visibility === 'SHARED' ? 'Shared' : 'Personal'}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      {detail ? (
        <>
          <View style={styles.row}>
            {(
              [
                ['overview', 'Overview'],
                ['outgoings', 'Spending'],
                ['wealth', 'Wealth'],
              ] as const
            ).map(([id, label]) => (
              <Pressable
                key={id}
                style={[styles.chip, section === id && styles.chipActive]}
                onPress={() => setSection(id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    section === id && styles.chipTextActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {section === 'overview' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Cashflow pulse</Text>
              <Text style={styles.meta}>
                Income{' '}
                {formatMoney(detail.summary?.incomeCents ?? 0, currency)} ·
                Spent{' '}
                {formatMoney(detail.summary?.expenseCents ?? 0, currency)} ·
                Planned{' '}
                {formatMoney(detail.summary?.plannedCents ?? 0, currency)}
              </Text>
              <Text style={styles.cardTitle}>
                Balance{' '}
                {formatMoney(detail.summary?.balanceCents ?? 0, currency)}
              </Text>
              <Text style={styles.meta}>
                Open Spending for bills and daily expenses, or Wealth for savings
                and debt.
              </Text>
              <View style={styles.row}>
                <Pressable
                  style={styles.buttonSecondary}
                  onPress={() => setSection('outgoings')}
                >
                  <Text style={styles.buttonTextSecondary}>Spending</Text>
                </Pressable>
                <Pressable
                  style={styles.buttonSecondary}
                  onPress={() => setSection('wealth')}
                >
                  <Text style={styles.buttonTextSecondary}>Wealth</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {section === 'outgoings' ? (
            <OutgoingsView
              budget={detail}
              preferredCurrency={currency}
              notify={notify}
              onChanged={() => void reload()}
            />
          ) : null}

          {section === 'wealth' ? (
            <WealthView
              account={account}
              budgetId={detail.id}
              currency={currency}
              notify={notify}
            />
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12, paddingBottom: 24 },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink },
  lede: { color: colors.muted, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 8 },
  button: {
    flex: 1,
    backgroundColor: colors.ink,
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondary: {
    flex: 1,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.paper, fontWeight: '700' },
  buttonTextSecondary: { color: colors.ink, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  hint: { color: colors.muted, fontSize: 12 },
  card: {
    backgroundColor: colors.paper,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 8,
  },
  cardTitle: { fontSize: 22, fontWeight: '700', color: colors.ink },
  meta: { color: colors.muted, fontSize: 12 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.paper,
  },
  tabActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  tabText: { color: colors.ink, fontWeight: '600', fontSize: 12 },
  tabTextActive: { color: colors.acid },
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
});
