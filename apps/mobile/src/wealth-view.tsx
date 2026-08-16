import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  accrueDebtInterest,
  createDebt,
  createDraftExpense,
  createInvestment,
  createSavingGoal,
  deleteDebt,
  deleteDraftExpense,
  deleteInvestment,
  deleteSavingGoal,
  formatMoney,
  getDraftImpact,
  getNetWorth,
  getWealthMeta,
  listDebts,
  listDraftExpenses,
  listInvestments,
  listSavingGoals,
  updateInvestment,
  updateSavingGoal,
  type Account,
  type Debt,
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
  const [debts, setDebts] = useState<Debt[]>([]);
  const [netWorth, setNetWorth] = useState<NetWorth | null>(null);
  const [impact, setImpact] = useState<DraftImpact | null>(null);
  const [meta, setMeta] = useState<{
    savingCategories: { id: string; label: string }[];
    investmentTypes: { id: string; label: string }[];
    debtTypes: { id: string; label: string }[];
  } | null>(null);

  const [goalName, setGoalName] = useState('');
  const [goalCategory, setGoalCategory] =
    useState<SavingGoal['category']>('emergency');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('');
  const [goalCustom, setGoalCustom] = useState('');
  const [goalMonthly, setGoalMonthly] = useState('');
  const [goalDay, setGoalDay] = useState('1');
  const [editingSavingId, setEditingSavingId] = useState<string | null>(null);
  const [editGoalName, setEditGoalName] = useState('');
  const [editGoalCategory, setEditGoalCategory] =
    useState<SavingGoal['category']>('emergency');
  const [editGoalCustom, setEditGoalCustom] = useState('');
  const [editGoalTarget, setEditGoalTarget] = useState('');
  const [editGoalCurrent, setEditGoalCurrent] = useState('');
  const [editGoalMonthly, setEditGoalMonthly] = useState('');
  const [editGoalDay, setEditGoalDay] = useState('1');

  const [invName, setInvName] = useState('');
  const [invType, setInvType] =
    useState<InvestmentAccount['accountType']>('tfsa');
  const [invGoal, setInvGoal] = useState('');
  const [invCurrent, setInvCurrent] = useState('');
  const [invCustom, setInvCustom] = useState('');
  const [editingInvestmentId, setEditingInvestmentId] = useState<string | null>(
    null,
  );
  const [editInvName, setEditInvName] = useState('');
  const [editInvType, setEditInvType] =
    useState<InvestmentAccount['accountType']>('tfsa');
  const [editInvCustom, setEditInvCustom] = useState('');
  const [editInvGoal, setEditInvGoal] = useState('');
  const [editInvCurrent, setEditInvCurrent] = useState('');

  const [debtName, setDebtName] = useState('');
  const [debtType, setDebtType] = useState<Debt['debtType']>('credit_card');
  const [debtBalance, setDebtBalance] = useState('');
  const [debtApr, setDebtApr] = useState('');
  const [debtPayment, setDebtPayment] = useState('');
  const [debtDay, setDebtDay] = useState('1');
  const [debtNote, setDebtNote] = useState('');

  const [draftName, setDraftName] = useState('');
  const [draftAmount, setDraftAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const money = (cents: number) =>
    formatMoney(cents, account.user.preferredCurrency || currency);

  const reload = useCallback(async () => {
    const [s, i, debtList, n, m] = await Promise.all([
      listSavingGoals(),
      listInvestments(),
      listDebts(),
      getNetWorth(),
      getWealthMeta(),
    ]);
    setSavings(s);
    setInvestments(i);
    setDebts(debtList);
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

  function startEditSaving(goal: SavingGoal) {
    setEditingSavingId(goal.id);
    setEditGoalName(goal.name);
    setEditGoalCategory(goal.category);
    setEditGoalCustom(goal.customLabel ?? '');
    setEditGoalTarget((goal.targetCents / 100).toFixed(2));
    setEditGoalCurrent((goal.currentCents / 100).toFixed(2));
    setEditGoalMonthly(
      goal.monthlyContributionCents
        ? (goal.monthlyContributionCents / 100).toFixed(2)
        : '',
    );
    setEditGoalDay(String(goal.contributionDay ?? 1));
  }

  function startEditInvestment(item: InvestmentAccount) {
    setEditingInvestmentId(item.id);
    setEditInvName(item.name);
    setEditInvType(item.accountType);
    setEditInvCustom(item.customLabel ?? '');
    setEditInvGoal((item.goalCents / 100).toFixed(2));
    setEditInvCurrent((item.currentCents / 100).toFixed(2));
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
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex]}
            placeholder="Monthly contribution"
            placeholderTextColor="#9BA49E"
            keyboardType="decimal-pad"
            value={goalMonthly}
            onChangeText={setGoalMonthly}
          />
          <TextInput
            style={[styles.input, styles.flex]}
            placeholder="Day (1-28)"
            placeholderTextColor="#9BA49E"
            keyboardType="number-pad"
            value={goalDay}
            onChangeText={setGoalDay}
          />
        </View>
        <Pressable
          disabled={busy}
          style={styles.button}
          onPress={() =>
            void run(async () => {
              if (!goalName.trim()) throw new Error('Name the saving goal.');
              const monthly = Number(goalMonthly);
              const hasMonthly =
                goalMonthly.trim() !== '' &&
                Number.isFinite(monthly) &&
                monthly > 0;
              await createSavingGoal({
                name: goalName.trim(),
                category: goalCategory,
                customLabel:
                  goalCategory === 'custom' ? goalCustom.trim() : undefined,
                targetCents: Math.round(Number(goalTarget || 0) * 100),
                currentCents: Math.round(Number(goalCurrent || 0) * 100),
                monthlyContributionCents: hasMonthly
                  ? Math.round(monthly * 100)
                  : null,
                contributionDay: hasMonthly ? Number(goalDay || 1) : null,
              });
              setGoalName('');
              setGoalTarget('');
              setGoalCurrent('');
              setGoalCustom('');
              setGoalMonthly('');
              notify('Saving goal added.');
            })
          }
        >
          <Text style={styles.buttonText}>Add saving goal</Text>
        </Pressable>
        {savings.map((goal) => (
          <View key={goal.id} style={styles.item}>
            {editingSavingId === goal.id ? (
              <View style={{ gap: 8 }}>
                <TextInput
                  style={styles.input}
                  value={editGoalName}
                  onChangeText={setEditGoalName}
                  placeholder="Goal name"
                  placeholderTextColor="#9BA49E"
                />
                <View style={styles.rowWrap}>
                  {(meta?.savingCategories ?? []).map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() =>
                        setEditGoalCategory(item.id as SavingGoal['category'])
                      }
                      style={[
                        styles.chip,
                        editGoalCategory === item.id && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          editGoalCategory === item.id && styles.chipTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {editGoalCategory === 'custom' ? (
                  <TextInput
                    style={styles.input}
                    placeholder="Custom category"
                    placeholderTextColor="#9BA49E"
                    value={editGoalCustom}
                    onChangeText={setEditGoalCustom}
                  />
                ) : null}
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, styles.flex]}
                    placeholder="Target"
                    placeholderTextColor="#9BA49E"
                    keyboardType="decimal-pad"
                    value={editGoalTarget}
                    onChangeText={setEditGoalTarget}
                  />
                  <TextInput
                    style={[styles.input, styles.flex]}
                    placeholder="Current"
                    placeholderTextColor="#9BA49E"
                    keyboardType="decimal-pad"
                    value={editGoalCurrent}
                    onChangeText={setEditGoalCurrent}
                  />
                </View>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, styles.flex]}
                    placeholder="Monthly contribution"
                    placeholderTextColor="#9BA49E"
                    keyboardType="decimal-pad"
                    value={editGoalMonthly}
                    onChangeText={setEditGoalMonthly}
                  />
                  <TextInput
                    style={[styles.input, styles.flex]}
                    placeholder="Day (1-28)"
                    placeholderTextColor="#9BA49E"
                    keyboardType="number-pad"
                    value={editGoalDay}
                    onChangeText={setEditGoalDay}
                  />
                </View>
                <View style={styles.row}>
                  <Pressable
                    disabled={busy}
                    style={[styles.button, styles.flex]}
                    onPress={() =>
                      void run(async () => {
                        if (!editGoalName.trim()) {
                          throw new Error('Name the saving goal.');
                        }
                        const monthly = Number(editGoalMonthly);
                        const hasMonthly =
                          editGoalMonthly.trim() !== '' &&
                          Number.isFinite(monthly) &&
                          monthly > 0;
                        await updateSavingGoal(goal.id, {
                          name: editGoalName.trim(),
                          category: editGoalCategory,
                          customLabel:
                            editGoalCategory === 'custom'
                              ? editGoalCustom.trim() || null
                              : null,
                          targetCents: Math.round(
                            Number(editGoalTarget || 0) * 100,
                          ),
                          currentCents: Math.round(
                            Number(editGoalCurrent || 0) * 100,
                          ),
                          monthlyContributionCents: hasMonthly
                            ? Math.round(monthly * 100)
                            : null,
                          contributionDay: hasMonthly
                            ? Number(editGoalDay || 1)
                            : null,
                        });
                        setEditingSavingId(null);
                        notify('Saving goal updated.');
                      })
                    }
                  >
                    <Text style={styles.buttonText}>Save</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.buttonSecondary, styles.flex]}
                    onPress={() => setEditingSavingId(null)}
                  >
                    <Text style={styles.buttonSecondaryText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.itemTitle}>{goal.name}</Text>
                <Text style={styles.sub}>
                  {money(goal.currentCents)} / {money(goal.targetCents)}
                </Text>
                {goal.monthlyContributionCents ? (
                  <Text style={styles.sub}>
                    Monthly {money(goal.monthlyContributionCents)} on day{' '}
                    {goal.contributionDay}
                  </Text>
                ) : null}
                <View style={styles.row}>
                  <Pressable
                    style={styles.chip}
                    onPress={() => startEditSaving(goal)}
                  >
                    <Text style={styles.chipText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={styles.chip}
                    disabled={busy}
                    onPress={() =>
                      void run(async () => {
                        await deleteSavingGoal(goal.id);
                        notify('Saving goal removed.');
                      })
                    }
                  >
                    <Text style={[styles.chipText, { color: colors.danger }]}>
                      Remove
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
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
            {editingInvestmentId === item.id ? (
              <View style={{ gap: 8 }}>
                <TextInput
                  style={styles.input}
                  value={editInvName}
                  onChangeText={setEditInvName}
                  placeholder="Portfolio name"
                  placeholderTextColor="#9BA49E"
                />
                <View style={styles.rowWrap}>
                  {(meta?.investmentTypes ?? []).map((type) => (
                    <Pressable
                      key={type.id}
                      onPress={() =>
                        setEditInvType(
                          type.id as InvestmentAccount['accountType'],
                        )
                      }
                      style={[
                        styles.chip,
                        editInvType === type.id && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          editInvType === type.id && styles.chipTextActive,
                        ]}
                      >
                        {type.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {editInvType === 'other' ? (
                  <TextInput
                    style={styles.input}
                    placeholder="Custom type"
                    placeholderTextColor="#9BA49E"
                    value={editInvCustom}
                    onChangeText={setEditInvCustom}
                  />
                ) : null}
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, styles.flex]}
                    placeholder="Goal"
                    placeholderTextColor="#9BA49E"
                    keyboardType="decimal-pad"
                    value={editInvGoal}
                    onChangeText={setEditInvGoal}
                  />
                  <TextInput
                    style={[styles.input, styles.flex]}
                    placeholder="Current"
                    placeholderTextColor="#9BA49E"
                    keyboardType="decimal-pad"
                    value={editInvCurrent}
                    onChangeText={setEditInvCurrent}
                  />
                </View>
                <View style={styles.row}>
                  <Pressable
                    disabled={busy}
                    style={[styles.button, styles.flex]}
                    onPress={() =>
                      void run(async () => {
                        if (!editInvName.trim()) {
                          throw new Error('Name the portfolio.');
                        }
                        await updateInvestment(item.id, {
                          name: editInvName.trim(),
                          accountType: editInvType,
                          customLabel:
                            editInvType === 'other'
                              ? editInvCustom.trim() || null
                              : null,
                          goalCents: Math.round(Number(editInvGoal || 0) * 100),
                          currentCents: Math.round(
                            Number(editInvCurrent || 0) * 100,
                          ),
                        });
                        setEditingInvestmentId(null);
                        notify('Investment updated.');
                      })
                    }
                  >
                    <Text style={styles.buttonText}>Save</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.buttonSecondary, styles.flex]}
                    onPress={() => setEditingInvestmentId(null)}
                  >
                    <Text style={styles.buttonSecondaryText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.itemTitle}>{item.name}</Text>
                <Text style={styles.sub}>
                  Current {money(item.currentCents)} · Goal{' '}
                  {money(item.goalCents)}
                </Text>
                <View style={styles.row}>
                  <Pressable
                    style={styles.chip}
                    onPress={() => startEditInvestment(item)}
                  >
                    <Text style={styles.chipText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={styles.chip}
                    disabled={busy}
                    onPress={() =>
                      void run(async () => {
                        await deleteInvestment(item.id);
                        notify('Investment removed.');
                      })
                    }
                  >
                    <Text style={[styles.chipText, { color: colors.danger }]}>
                      Remove
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Debts</Text>
        <TextInput
          style={styles.input}
          placeholder="Debt name"
          placeholderTextColor="#9BA49E"
          value={debtName}
          onChangeText={setDebtName}
        />
        <View style={styles.rowWrap}>
          {(meta?.debtTypes ?? []).map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setDebtType(item.id as Debt['debtType'])}
              style={[styles.chip, debtType === item.id && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  debtType === item.id && styles.chipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex]}
            placeholder="Balance"
            placeholderTextColor="#9BA49E"
            keyboardType="decimal-pad"
            value={debtBalance}
            onChangeText={setDebtBalance}
          />
          <TextInput
            style={[styles.input, styles.flex]}
            placeholder="APR %"
            placeholderTextColor="#9BA49E"
            keyboardType="decimal-pad"
            value={debtApr}
            onChangeText={setDebtApr}
          />
        </View>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex]}
            placeholder="Monthly payment"
            placeholderTextColor="#9BA49E"
            keyboardType="decimal-pad"
            value={debtPayment}
            onChangeText={setDebtPayment}
          />
          <TextInput
            style={[styles.input, styles.flex]}
            placeholder="Day 1-28"
            placeholderTextColor="#9BA49E"
            keyboardType="number-pad"
            value={debtDay}
            onChangeText={setDebtDay}
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Note (optional)"
          placeholderTextColor="#9BA49E"
          value={debtNote}
          onChangeText={setDebtNote}
        />
        <Pressable
          disabled={busy}
          style={styles.button}
          onPress={() =>
            void run(async () => {
              if (!debtName.trim()) throw new Error('Name the debt.');
              const payment = Number(debtPayment);
              const hasPayment =
                debtPayment.trim() !== '' &&
                Number.isFinite(payment) &&
                payment > 0;
              await createDebt({
                name: debtName.trim(),
                debtType,
                balanceCents: Math.round(Number(debtBalance || 0) * 100),
                interestAprPercent: Number(debtApr || 0),
                monthlyPaymentCents: hasPayment
                  ? Math.round(payment * 100)
                  : null,
                paymentDay: hasPayment ? Number(debtDay || 1) : null,
                note: debtNote.trim() || undefined,
              });
              setDebtName('');
              setDebtBalance('');
              setDebtApr('');
              setDebtPayment('');
              setDebtNote('');
              notify('Debt added.');
            })
          }
        >
          <Text style={styles.buttonText}>Add debt</Text>
        </Pressable>
        {debts.map((debt) => (
          <View key={debt.id} style={styles.item}>
            <Text style={styles.itemTitle}>{debt.name}</Text>
            <Text style={styles.sub}>
              {money(debt.balanceCents)} · {debt.interestAprPercent}% APR · est{' '}
              {money(debt.estimatedMonthlyInterestCents ?? 0)}/mo interest
            </Text>
            {debt.monthlyPaymentCents ? (
              <Text style={styles.sub}>
                Pays {money(debt.monthlyPaymentCents)} on day {debt.paymentDay}
              </Text>
            ) : null}
            <View style={styles.row}>
              <Pressable
                disabled={busy}
                style={styles.chip}
                onPress={() =>
                  void run(async () => {
                    await accrueDebtInterest(debt.id);
                    notify('Interest added to balance.');
                  })
                }
              >
                <Text style={styles.chipText}>Add interest</Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    await deleteDebt(debt.id);
                    notify('Debt removed.');
                  })
                }
              >
                <Text style={{ color: colors.danger, fontWeight: '700' }}>
                  Remove
                </Text>
              </Pressable>
            </View>
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
  buttonSecondary: {
    backgroundColor: colors.paper,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonSecondaryText: { color: colors.ink, fontWeight: '700', fontSize: 12 },
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
