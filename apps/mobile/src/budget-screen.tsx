import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createBudget,
  formatMoney,
  getBudget,
  getHouseholdMoneyLens,
  listBudgets,
  type Account,
  type Budget,
  type HouseholdMoneyLens,
} from './api';
import {
  loadLastBudgetId,
  saveLastBudgetId,
} from './budget-selection';
import {
  partnerVisibilityDiscoveryLine,
  resolveBudgetSelection,
  type BudgetListItem,
} from '@life-os/shared';
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

type MoneyScope = 'personal' | 'household';

type Props = {
  account: Account;
  notify: (message: string) => void;
  onOpenHouseholdSettings?: () => void;
};

export function BudgetScreen({ account, notify, onOpenHouseholdSettings }: Props) {
  const [displayBudgets, setDisplayBudgets] = useState<BudgetListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Budget | null>(null);
  const [householdLens, setHouseholdLens] = useState<HouseholdMoneyLens | null>(null);
  const [moneyScope, setMoneyScope] = useState<MoneyScope>('personal');
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<'overview' | 'outgoings' | 'wealth'>('overview');
  const activeIdRef = useRef<string | null>(null);
  const canShare = (account.members?.length ?? 0) >= 2;
  const currency = account.user.preferredCurrency || 'GBP';
  const partner = account.members.find((member) => member.id !== account.user.id);
  const sharedBudgetId = useMemo(
    () =>
      displayBudgets.find(
        (budget) =>
          budget.visibility === 'SHARED' && budget.ownerUserId === account.user.id,
      )?.id ?? null,
    [displayBudgets, account.user.id],
  );
  const visibilityLines = partner
    ? partnerVisibilityDiscoveryLine({
        partnerName: partner.displayName,
        yourGrant: account.moneyVisibilityGrant ?? 'SHARED_BILLS_ONLY',
        partnerGrant: account.partnerMoneyVisibilityGrant ?? null,
      })
    : null;

  const reload = useCallback(
    async (preferredId?: string) => {
      const list = await listBudgets();
      const storedId = await loadLastBudgetId(account.user.id);
      const { displayBudgets: visible, selectedId: nextId } = resolveBudgetSelection(
        list,
        account.user.id,
        {
          preferredId,
          storedId,
          currentId: activeIdRef.current,
          profileCurrency: currency,
        },
      );
      setDisplayBudgets(visible);
      const personalId =
        visible.find(
          (budget) =>
            budget.visibility === 'PRIVATE' && budget.ownerUserId === account.user.id,
        )?.id ?? nextId;
      if (personalId !== activeIdRef.current) {
        setActiveId(personalId);
        activeIdRef.current = personalId;
      }
      if (personalId) {
        await saveLastBudgetId(account.user.id, personalId);
        setDetail(await getBudget(personalId));
      } else {
        setDetail(null);
      }
      if (canShare) {
        const now = new Date();
        setHouseholdLens(
          await getHouseholdMoneyLens(now.getFullYear(), now.getMonth() + 1),
        );
      }
    },
    [account.user.id, canShare, currency],
  );

  useEffect(() => {
    void reload().catch((error) =>
      notify(error instanceof Error ? error.message : 'Could not load budgets.'),
    );
  }, [reload, notify, account.user.preferredCurrency]);

  async function createPersonal() {
    setBusy(true);
    try {
      const created = await createBudget({
        name: 'Personal budget',
        visibility: 'PRIVATE',
        currency,
      });
      setMoneyScope('personal');
      setActiveId(created.id);
      activeIdRef.current = created.id;
      await reload(created.id);
      notify('Personal budget created.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not create budget.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.stack}>
      <FocusHero
        accentDot
        eyebrow="Money"
        meta="Calm cashflow pulse — overview, spending, and wealth in one place."
        title="Your financial rhythm"
      />

      {canShare ? (
        <SurfaceCard>
          <Text style={styles.eyebrow}>Viewing</Text>
          <View style={styles.row}>
            {(['personal', 'household'] as const).map((scope) => (
              <Pressable
                key={scope}
                style={[styles.scopeChip, moneyScope === scope && styles.scopeChipActive]}
                onPress={() => setMoneyScope(scope)}
              >
                <Text
                  style={[
                    styles.scopeChipText,
                    moneyScope === scope && styles.scopeChipTextActive,
                  ]}
                >
                  {scope === 'personal' ? 'Personal' : 'Household'}
                </Text>
              </Pressable>
            ))}
          </View>
          {visibilityLines ? (
            <Text style={styles.meta}>
              {visibilityLines.yours}{' '}
              <Text
                onPress={() => onOpenHouseholdSettings?.()}
                style={styles.link}
              >
                Change in Household
              </Text>
              {visibilityLines.partner ? `\n${visibilityLines.partner}` : ''}
            </Text>
          ) : null}
        </SurfaceCard>
      ) : null}

      {!detail && moneyScope === 'personal' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No personal budget yet</Text>
          <AppButton disabled={busy} onPress={() => void createPersonal()} variant="acid">
            <AcidButtonLabel>Create personal space</AcidButtonLabel>
          </AppButton>
        </View>
      ) : null}

      {moneyScope === 'personal' && detail ? (
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
              meta={`Income ${formatMoney(detail.summary?.incomeCents ?? 0, currency)} · Spent ${formatMoney(detail.summary?.expenseCents ?? 0, currency)}`}
              title={formatMoney(detail.summary?.balanceCents ?? 0, currency)}
              subtitle="Balance this month"
            />
          ) : null}

          {section === 'outgoings' ? (
            <OutgoingsView
              budget={detail}
              preferredCurrency={currency}
              notify={notify}
              onChanged={() => void reload(activeId ?? undefined)}
              canMoveToHousehold={canShare && detail.visibility === 'PRIVATE'}
              yourGrant={account.moneyVisibilityGrant ?? 'SHARED_BILLS_ONLY'}
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

      {moneyScope === 'household' && householdLens ? (
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
              eyebrow="Household overview"
              meta="Combined outgoings this month"
              title={formatMoney(householdLens.totals.expenseCents, householdLens.currency)}
              subtitle={
                householdLens.emptySharedOnly
                  ? 'No household bills yet. Move a bill from Personal.'
                  : 'Household spending'
              }
            />
          ) : null}
          {section === 'outgoings' ? (
            <OutgoingsView
              preferredCurrency={currency}
              notify={notify}
              onChanged={() => void reload(activeId ?? undefined)}
              householdLens={householdLens}
              viewerId={account.user.id}
            />
          ) : null}
          {section === 'wealth' ? (
            <WealthView
              account={account}
              budgetId={sharedBudgetId}
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
  row: { flexDirection: 'row', gap: 8 },
  eyebrow: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
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
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  link: { color: colors.sageDeep, fontWeight: '700', textDecorationLine: 'underline' },
  scopeChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  scopeChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  scopeChipText: { color: colors.ink, fontWeight: '700', fontSize: 12 },
  scopeChipTextActive: { color: colors.acid },
});
