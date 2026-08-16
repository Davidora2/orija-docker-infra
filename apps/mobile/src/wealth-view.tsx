import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  createDraftExpense,
  createInvestment,
  createSavingGoal,
  deleteDraftExpense,
  formatMoney,
  getDraftImpact,
  getNetWorth,
  getWealthMeta,
  listDraftExpenses,
  listInvestments,
  listSavingGoals,
  type Account,
  type DraftImpact,
  type InvestmentAccount,
  type NetWorth,
  type SavingGoal,
} from './api';

const colors = {
  ink: '#14241F',
  paper: '#FFFFFF',
  line: '#DDE2DD',
  muted: '#6C7771',
  sage: '#DBE8D7',
  sageDeep: '#617A57',
  dangerSoft: '#F8E4DF',
  danger: '#8A3D30',
};

type Props = {
  account: Account;
  budgetId: string | null;
  currency: string;
  notify: (message: string) => void;
};

export function WealthView({ account, budgetId, currency, notify }: Props) {
  const [savings, setSavings] = useState<SavingGoal[]>([]);
  const [investments, setInvestments] = useState<InvestmentAccount[]>([]);
  const [netWorth, setNetWorth] = useState<NetWorth | null>(null);
  const [impact, setImpact] = useState<DraftImpact | null>(null);
  const [meta, setMeta] = useState<{
    savingCategories: { id: string; label: string }[];
    investmentTypes: { id: string; label: string }[];
  } | null>(null);

  const [goalName, setGoalName] = useState('');
  const [goalCategory, setGoalCategory] =
    useState<SavingGoal['category']>('emergency');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('');
  const [goalCustom, setGoalCustom] = useState('');

  const [invName, setInvName] = useState('');
  const [invType, setInvType] =
    useState<InvestmentAccount['accountType']>('tfsa');
  const [invGoal, setInvGoal] = useState('');
  const [invCurrent, setInvCurrent] = useState('');
  const [invCustom, setInvCustom] = useState('');

  const [draftName, setDraftName] = useState('');
  const [draftAmount, setDraftAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const money = (cents: number) => formatMoney(cents, currency);

  const reload = useCallback(async () => {
    const [s, i, n, m] = await Promise.all([
      listSavingGoals(),
      listInvestments(),
      getNetWorth(),
      getWealthMeta(),
    ]);
    setSavings(s);
    setInvestments(i);
    setNetWorth(n);
    setMeta(m);
    if (budgetId) {
      const [d, imp] = await Promise.all([
        listDraftExpenses(budgetId),
        getDraftImpact(budgetId),
      ]);
      void d;
      setImpact(imp);
    }
  }, [budgetId]);

  useEffect(() => {
    void reload().catch((err) =>
      notify(err instanceof Error ? err.message : 'Could not load wealth'),
    );
  }, [reload, notify]);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    try {
      await work();
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      {netWorth ? (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>NET WORTH</Text>
          <Text style={styles.title}>{money(netWorth.totalVisibleCents)}</Text>
          <Text style={styles.sub}>
            Personal {money(netWorth.personal.netWorthCents)} · Household{' '}
            {money(netWorth.household.netWorthCents)}
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.heading}>Saving goals</Text>
        <TextInput
          style={styles.input}
          placeholder="Goal name"
          placeholderTextColor="#9BA49E"
          value={goalName}
          onChangeText={setGoalName}
        />
        <View style={styles.rowWrap}>
          {(meta?.savingCategories ?? []).map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setGoalCategory(item.id as SavingGoal['category'])}
              style={[
                styles.chip,
                goalCategory === item.id && styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  goalCategory === item.id && styles.chipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {goalCategory === 'custom' ? (
          <TextInput
            style={styles.input}
            placeholder="Custom category"
            placeholderTextColor="#9BA49E"
            value={goalCustom}
            onChangeText={setGoalCustom}
          />
        ) : null}
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex]}
            placeholder="Target"
            placeholderTextColor="#9BA49E"
            keyboardType="decimal-pad"
            value={goalTarget}
            onChangeText={setGoalTarget}
          />
          <TextInput
            style={[styles.input, styles.flex]}
            placeholder="Current"
            placeholderTextColor="#9BA49E"
            keyboardType="decimal-pad"
            value={goalCurrent}
            onChangeText={setGoalCurrent}
          />
        </View>
        <Pressable
          disabled={busy}
          style={styles.button}
          onPress={() =>
            void run(async () => {
              if (!goalName.trim()) throw new Error('Name the saving goal.');
              await createSavingGoal({
                name: goalName.trim(),
                category: goalCategory,
                customLabel:
                  goalCategory === 'custom' ? goalCustom.trim() : undefined,
                targetCents: Math.round(Number(goalTarget || 0) * 100),
                currentCents: Math.round(Number(goalCurrent || 0) * 100),
              });
              setGoalName('');
              setGoalTarget('');
              setGoalCurrent('');
              setGoalCustom('');
              notify('Saving goal added.');
            })
          }
        >
          <Text style={styles.buttonText}>Add saving goal</Text>
        </Pressable>
        {savings.map((goal) => (
          <View key={goal.id} style={styles.item}>
            <Text style={styles.itemTitle}>{goal.name}</Text>
            <Text style={styles.sub}>
              {money(goal.currentCents)} / {money(goal.targetCents)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Investments</Text>
        <TextInput
          style={styles.input}
          placeholder="Portfolio name"
          placeholderTextColor="#9BA49E"
          value={invName}
          onChangeText={setInvName}
        />
        <View style={styles.rowWrap}>
          {(meta?.investmentTypes ?? []).map((item) => (
            <Pressable
              key={item.id}
              onPress={() =>
                setInvType(item.id as InvestmentAccount['accountType'])
              }
              style={[styles.chip, invType === item.id && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  invType === item.id && styles.chipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {invType === 'other' ? (
          <TextInput
            style={styles.input}
            placeholder="Custom type"
            placeholderTextColor="#9BA49E"
            value={invCustom}
            onChangeText={setInvCustom}
          />
        ) : null}
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex]}
            placeholder="Goal"
            placeholderTextColor="#9BA49E"
            keyboardType="decimal-pad"
            value={invGoal}
            onChangeText={setInvGoal}
          />
          <TextInput
            style={[styles.input, styles.flex]}
            placeholder="Current"
            placeholderTextColor="#9BA49E"
            keyboardType="decimal-pad"
            value={invCurrent}
            onChangeText={setInvCurrent}
          />
        </View>
        <Pressable
          disabled={busy}
          style={styles.button}
          onPress={() =>
            void run(async () => {
              if (!invName.trim()) throw new Error('Name the portfolio.');
              await createInvestment({
                name: invName.trim(),
                accountType: invType,
                customLabel: invType === 'other' ? invCustom.trim() : undefined,
                goalCents: Math.round(Number(invGoal || 0) * 100),
                currentCents: Math.round(Number(invCurrent || 0) * 100),
              });
              setInvName('');
              setInvGoal('');
              setInvCurrent('');
              setInvCustom('');
              notify('Investment portfolio added.');
            })
          }
        >
          <Text style={styles.buttonText}>Add portfolio</Text>
        </Pressable>
        {investments.map((item) => (
          <View key={item.id} style={styles.item}>
            <Text style={styles.itemTitle}>{item.name}</Text>
            <Text style={styles.sub}>
              Current {money(item.currentCents)} · Goal {money(item.goalCents)}
            </Text>
          </View>
        ))}
      </View>

      {budgetId ? (
        <View style={styles.card}>
          <Text style={styles.heading}>Draft monthly expense</Text>
          {impact ? (
            <View
              style={[
                styles.impact,
                impact.impact.wouldOverspend && styles.impactBad,
              ]}
            >
              <Text style={styles.sub}>
                After drafts: {money(impact.impact.remainingWithDraftsCents)}
              </Text>
              {impact.impact.wouldOverspend ? (
                <Text style={styles.flag}>
                  Flag: overspend {money(impact.impact.overspendCents)}
                </Text>
              ) : null}
            </View>
          ) : null}
          <TextInput
            style={styles.input}
            placeholder="Draft expense"
            placeholderTextColor="#9BA49E"
            value={draftName}
            onChangeText={setDraftName}
          />
          <TextInput
            style={styles.input}
            placeholder="Amount"
            placeholderTextColor="#9BA49E"
            keyboardType="decimal-pad"
            value={draftAmount}
            onChangeText={setDraftAmount}
          />
          <Pressable
            disabled={busy}
            style={styles.button}
            onPress={() =>
              void run(async () => {
                const pounds = Number(draftAmount);
                if (!draftName.trim() || !Number.isFinite(pounds) || pounds <= 0) {
                  throw new Error('Enter name and amount.');
                }
                await createDraftExpense(budgetId, {
                  name: draftName.trim(),
                  amountCents: Math.round(pounds * 100),
                });
                setDraftName('');
                setDraftAmount('');
                notify('Draft expense added.');
              })
            }
          >
            <Text style={styles.buttonText}>Add draft</Text>
          </Pressable>
          {(impact?.drafts ?? []).map((draft) => (
            <View key={draft.id} style={styles.itemRow}>
              <Text style={styles.sub}>
                {draft.name} · {money(draft.amountCents)}
              </Text>
              <Pressable
                onPress={() =>
                  void run(async () => {
                    await deleteDraftExpense(budgetId, draft.id);
                  })
                }
              >
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
          ))}
          <Text style={styles.meta}>
            {account.user.displayName} · {currency}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  card: {
    backgroundColor: colors.paper,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 10,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.sageDeep,
    letterSpacing: 1,
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink },
  heading: { fontSize: 22, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12, color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.ink,
  },
  row: { flexDirection: 'row', gap: 8 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flex: { flex: 1 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#EEF2EA',
  },
  chipActive: { backgroundColor: colors.ink },
  chipText: { fontSize: 11, fontWeight: '700', color: colors.muted },
  chipTextActive: { color: '#D6F57A' },
  button: {
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#F4F5F0', fontWeight: '700', fontSize: 12 },
  item: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 10 },
  itemTitle: { fontWeight: '700', color: colors.ink },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: 10,
  },
  remove: { color: colors.danger, fontWeight: '700', fontSize: 12 },
  impact: {
    backgroundColor: colors.sage,
    borderRadius: 12,
    padding: 10,
  },
  impactBad: { backgroundColor: colors.dangerSoft },
  flag: { color: colors.danger, fontWeight: '700', marginTop: 4 },
  meta: { fontSize: 11, color: colors.muted },
});
