import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createBudget,
  formatMoney,
  getBudget,
  listBudgets,
  type Account,
  type Budget,
} from './api';
import {
  loadLastBudgetId,
  saveLastBudgetId,
} from './budget-selection';
import { resolveBudgetSelection, type BudgetListItem } from '@life-os/shared';
import { LifeIcon } from './life-icon';
import { OutgoingsView } from './outgoings-view';
import { WealthView } from './wealth-view';
import {
  AcidButtonLabel,
  AppButton,
  FocusHero,
  SegmentedControl,
  SurfaceCard,
} from './ui';

const colors = {
  ink: '#14241F',
  paper: '#FFFFFF',
  line: '#DDE2DD',
  muted: '#6C7771',
  sageDeep: '#617A57',
  acid: '#D6F57A',
};

type Props = {
  account: Account;
  notify: (message: string) => void;
};

export function BudgetScreen({ account, notify }: Props) {
  const [budgets, setBudgets] = useState<BudgetListItem[]>([]);
  const [displayBudgets, setDisplayBudgets] = useState<BudgetListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Budget | null>(null);
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<'overview' | 'outgoings' | 'wealth'>('overview');
  const activeIdRef = useRef<string | null>(null);
  const canShare = (account.members?.length ?? 0) >= 2;
  const currency = account.user.preferredCurrency || 'GBP';

  const reload = useCallback(
    async (preferredId?: string) => {
      const list = await listBudgets();
      const storedId = await loadLastBudgetId(account.user.id);
      const { budgets: unique, displayBudgets: visible, selectedId: nextId } =
        resolveBudgetSelection(list, account.user.id, {
          preferredId,
          storedId,
          currentId: activeIdRef.current,
          profileCurrency: currency,
        });
      setBudgets(unique);
      setDisplayBudgets(visible);
      if (nextId !== activeIdRef.current) {
        setActiveId(nextId);
        activeIdRef.current = nextId;
        if (nextId) {
          await saveLastBudgetId(account.user.id, nextId);
          setDetail(await getBudget(nextId));
        } else {
          setDetail(null);
        }
      } else if (nextId) {
        await saveLastBudgetId(account.user.id, nextId);
        void getBudget(nextId).then(setDetail);
      }
    },
    [account.user.id, currency],
  );

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
      activeIdRef.current = created.id;
      await reload(created.id);
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

  async function selectBudget(id: string) {
    setActiveId(id);
    activeIdRef.current = id;
    await saveLastBudgetId(account.user.id, id);
    try {
      setDetail(await getBudget(id));
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not open this budget.');
    }
  }

  async function focusOrCreate(visibility: 'PRIVATE' | 'SHARED') {
    const existing = displayBudgets.find(
      (budget) => budget.visibility === visibility,
    );
    if (existing) {
      await selectBudget(existing.id);
      return;
    }
    await create(visibility);
  }

  return (
    <ScrollView contentContainerStyle={styles.stack}>
      <FocusHero
        accentDot
        eyebrow="Money"
        meta="Calm cashflow pulse — overview, spending, and wealth in one place."
        title="Your financial rhythm"
      />

      <View style={styles.row}>
        <AppButton
          disabled={busy}
          onPress={() => void focusOrCreate('PRIVATE')}
          style={{ flex: 1 }}
          variant="acid"
        >
          <AcidButtonLabel icon={<LifeIcon color="#2F431E" name="add" size={16} />}>
            Personal
          </AcidButtonLabel>
        </AppButton>
        <AppButton
          disabled={!canShare || busy}
          onPress={() => void focusOrCreate('SHARED')}
          style={{ flex: 1 }}
          variant="secondary"
        >
          Shared
        </AppButton>
      </View>
      {!canShare ? (
        <Text style={styles.hint}>
          Link a partner in your profile to create a shared household budget.
        </Text>
      ) : null}

      {displayBudgets.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No budgets yet</Text>
          <Text style={styles.meta}>
            Create a personal budget to track income and spending.
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.tabs}>
            {displayBudgets.map((budget) => (
              <Pressable
                key={budget.id}
                style={[styles.tab, activeId === budget.id && styles.tabActive]}
                onPress={() => void selectBudget(budget.id)}
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
          <SegmentedControl
            value={section}
            onChange={setSection}
            options={[
              { id: 'overview', label: 'Overview', icon: 'overview' },
              { id: 'outgoings', label: 'Spending', icon: 'spending' },
              { id: 'wealth', label: 'Wealth', icon: 'wealth' },
            ]}
          />

          {section === 'overview' ? (
            <FocusHero
              accentDot
              eyebrow="Cashflow pulse"
              meta={`Income ${formatMoney(detail.summary?.incomeCents ?? 0, currency)} · Spent ${formatMoney(detail.summary?.expenseCents ?? 0, currency)} · Planned ${formatMoney(detail.summary?.plannedCents ?? 0, currency)}`}
              title={formatMoney(detail.summary?.balanceCents ?? 0, currency)}
              subtitle="Balance this month"
              actions={
                <>
                  <AppButton onPress={() => setSection('outgoings')} variant="acid">
                    <AcidButtonLabel>Review spending</AcidButtonLabel>
                  </AppButton>
                  <AppButton onPress={() => setSection('wealth')} variant="outlineDark">
                    Open wealth
                  </AppButton>
                </>
              }
            />
          ) : null}

          {section === 'outgoings' ? (
            <OutgoingsView
              budget={detail}
              preferredCurrency={currency}
              notify={notify}
              onChanged={() => void reload(activeId ?? undefined)}
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
    flexDirection: 'row',
    gap: 5,
    backgroundColor: colors.ink,
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondary: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
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
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.paper,
    flexDirection: 'row',
    gap: 5,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.ink, fontWeight: '600', fontSize: 12 },
  chipTextActive: { color: colors.acid },
});
