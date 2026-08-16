import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  addBudgetEntry,
  createBudget,
  createBudgetCategory,
  formatMoney,
  getBudget,
  listBudgets,
  updateBudgetCategory,
  updateBudgetEntry,
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
  sage: '#DBE8D7',
  sageDeep: '#617A57',
  acid: '#D6F57A',
  danger: '#C9634F',
};

type Props = {
  account: Account;
  notify: (message: string) => void;
};

export function BudgetScreen({ account, notify }: Props) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Budget | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [kind, setKind] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [occurredOn, setOccurredOn] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<'outgoings' | 'ledger' | 'wealth'>('outgoings');
  const canShare = (account.members?.length ?? 0) >= 2;
  const currency = account.user.preferredCurrency || 'GBP';

  const reload = useCallback(async () => {
    const list = await listBudgets();
    setBudgets(list);
    const nextId = activeId && list.some((budget) => budget.id === activeId)
      ? activeId
      : list[0]?.id ?? null;
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

  useEffect(() => {
    if (detail?.categories?.[0] && !categoryId) {
      setCategoryId(detail.categories[0].id);
    }
  }, [detail, categoryId]);

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

  async function saveEntry() {
    if (!detail) return;
    const pounds = Number(amount);
    if (!Number.isFinite(pounds) || pounds <= 0) {
      notify('Enter a positive amount.');
      return;
    }
    setBusy(true);
    try {
      await addBudgetEntry(detail.id, {
        kind,
        amountCents: Math.round(pounds * 100),
        categoryId: kind === 'EXPENSE' ? categoryId : null,
        note: note.trim(),
        occurredOn: occurredOn || undefined,
      });
      setAmount('');
      setNote('');
      setDetail(await getBudget(detail.id));
      notify('Entry saved.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save entry.');
    } finally {
      setBusy(false);
    }
  }

  async function addCategory() {
    if (!detail) return;
    const name = newCategoryName.trim();
    if (!name) {
      notify('Enter a category name.');
      return;
    }
    setBusy(true);
    try {
      const created = await createBudgetCategory(detail.id, { name });
      setNewCategoryName('');
      setCategoryId(created.id);
      setDetail(await getBudget(detail.id));
      notify('Category added.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not add category.');
    } finally {
      setBusy(false);
    }
  }

  async function setPlanned(categoryIdToUpdate: string, planned: string) {
    if (!detail) return;
    const pounds = Number(planned);
    if (!Number.isFinite(pounds) || pounds < 0) return;
    try {
      await updateBudgetCategory(detail.id, categoryIdToUpdate, {
        plannedCents: Math.round(pounds * 100),
      });
      setDetail(await getBudget(detail.id));
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update category.');
    }
  }

  async function renameCategory(categoryIdToUpdate: string, name: string) {
    if (!detail) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = detail.categories?.find((item) => item.id === categoryIdToUpdate);
    if (existing && existing.name === trimmed) return;
    try {
      await updateBudgetCategory(detail.id, categoryIdToUpdate, {
        name: trimmed,
      });
      setDetail(await getBudget(detail.id));
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not rename category.');
    }
  }

  async function changeEntryCategory(entryId: string, nextCategoryId: string | null) {
    if (!detail) return;
    setBusy(true);
    try {
      await updateBudgetEntry(detail.id, entryId, {
        categoryId: nextCategoryId,
      });
      setDetail(await getBudget(detail.id));
      notify('Entry category updated.');
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not update entry category.',
      );
    } finally {
      setBusy(false);
    }
  }

  function categoryName(id: string | null) {
    if (!id) return 'Uncategorised';
    return (
      detail?.categories?.find((category) => category.id === id)?.name ??
      'Uncategorised'
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.stack}>
      <Text style={styles.title}>Budgets</Text>
      <Text style={styles.lede}>
        Keep a personal budget private. Shared budgets are visible to your linked
        partner.
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
          <Text style={styles.meta}>Create a personal budget to track income and spending.</Text>
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
                  setCategoryId(null);
                  void getBudget(budget.id).then(setDetail);
                }}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeId === budget.id && styles.tabTextActive,
                  ]}
                >
                  {budget.name} · {budget.visibility === 'SHARED' ? 'Shared' : 'Personal'}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      {detail ? (
        <>
          <View style={styles.row}>
            <Pressable
              style={[styles.chip, section === 'outgoings' && styles.chipActive]}
              onPress={() => setSection('outgoings')}
            >
              <Text
                style={[
                  styles.chipText,
                  section === 'outgoings' && styles.chipTextActive,
                ]}
              >
                Outgoings
              </Text>
            </Pressable>
            <Pressable
              style={[styles.chip, section === 'ledger' && styles.chipActive]}
              onPress={() => setSection('ledger')}
            >
              <Text
                style={[
                  styles.chipText,
                  section === 'ledger' && styles.chipTextActive,
                ]}
              >
                Ledger
              </Text>
            </Pressable>
            <Pressable
              style={[styles.chip, section === 'wealth' && styles.chipActive]}
              onPress={() => setSection('wealth')}
            >
              <Text
                style={[
                  styles.chipText,
                  section === 'wealth' && styles.chipTextActive,
                ]}
              >
                Wealth
              </Text>
            </Pressable>
          </View>

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

          {section === 'ledger' ? (
            <>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>This period</Text>
            <Text style={styles.cardTitle}>
              {formatMoney(detail.summary?.balanceCents ?? 0, currency)}
            </Text>
            <Text style={styles.meta}>
              In {formatMoney(detail.summary?.incomeCents ?? 0, currency)} · Out{' '}
              {formatMoney(detail.summary?.expenseCents ?? 0, currency)} · Planned{' '}
              {formatMoney(detail.summary?.plannedCents ?? 0, currency)}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.eyebrow}>Categories</Text>
            {(detail.categories ?? []).map((category) => (
              <View key={category.id} style={styles.categoryRow}>
                <View style={{ flex: 1, gap: 4 }}>
                  <TextInput
                    style={styles.categoryNameInput}
                    defaultValue={category.name}
                    onEndEditing={(event) =>
                      void renameCategory(category.id, event.nativeEvent.text)
                    }
                  />
                  <Text style={styles.meta}>
                    Spent {formatMoney(category.spentCents ?? 0, currency)}
                  </Text>
                </View>
                <TextInput
                  style={styles.plannedInput}
                  keyboardType="decimal-pad"
                  defaultValue={(category.plannedCents / 100).toFixed(0)}
                  onEndEditing={(event) =>
                    void setPlanned(category.id, event.nativeEvent.text)
                  }
                />
              </View>
            ))}
            <TextInput
              style={styles.input}
              placeholder="New category name"
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
          </View>

          <View style={styles.card}>
            <Text style={styles.eyebrow}>Add entry</Text>
            <View style={styles.row}>
              {(['EXPENSE', 'INCOME'] as const).map((value) => (
                <Pressable
                  key={value}
                  style={[styles.chip, kind === value && styles.chipActive]}
                  onPress={() => setKind(value)}
                >
                  <Text
                    style={[styles.chipText, kind === value && styles.chipTextActive]}
                  >
                    {value === 'EXPENSE' ? 'Expense' : 'Income'}
                  </Text>
                </Pressable>
              ))}
            </View>
            {kind === 'EXPENSE' ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.tabs}>
                  {(detail.categories ?? []).map((category) => (
                    <Pressable
                      key={category.id}
                      style={[
                        styles.chip,
                        categoryId === category.id && styles.chipActive,
                      ]}
                      onPress={() => setCategoryId(category.id)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          categoryId === category.id && styles.chipTextActive,
                        ]}
                      >
                        {category.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            ) : null}
            <TextInput
              style={styles.input}
              placeholder="Amount"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
            <Text style={styles.meta}>Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9BA49E"
              value={occurredOn}
              onChangeText={setOccurredOn}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Note"
              value={note}
              onChangeText={setNote}
            />
            <Pressable
              style={[styles.button, busy && styles.disabled]}
              disabled={busy}
              onPress={() => void saveEntry()}
            >
              <Text style={styles.buttonText}>Save entry</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.eyebrow}>Recent</Text>
            {(detail.entries ?? []).slice(0, 12).map((entry) => (
              <View key={entry.id} style={styles.entryBlock}>
                <View style={styles.entryRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.categoryName}>
                      {entry.kind === 'INCOME' ? 'Income' : 'Expense'}
                      {entry.note ? ` · ${entry.note}` : ''}
                    </Text>
                    <Text style={styles.meta}>
                      {entry.occurredOn}
                      {entry.kind === 'EXPENSE'
                        ? ` · ${categoryName(entry.categoryId)}`
                        : ''}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: entry.kind === 'INCOME' ? colors.sageDeep : colors.danger,
                      fontWeight: '700',
                    }}
                  >
                    {entry.kind === 'INCOME' ? '+' : '-'}
                    {formatMoney(entry.amountCents, currency)}
                  </Text>
                </View>
                {entry.kind === 'EXPENSE' ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.tabs}>
                      <Pressable
                        style={[
                          styles.chip,
                          !entry.categoryId && styles.chipActive,
                        ]}
                        disabled={busy}
                        onPress={() => void changeEntryCategory(entry.id, null)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            !entry.categoryId && styles.chipTextActive,
                          ]}
                        >
                          Uncategorised
                        </Text>
                      </Pressable>
                      {(detail.categories ?? []).map((category) => (
                        <Pressable
                          key={category.id}
                          style={[
                            styles.chip,
                            entry.categoryId === category.id && styles.chipActive,
                          ]}
                          disabled={busy}
                          onPress={() =>
                            void changeEntryCategory(entry.id, category.id)
                          }
                        >
                          <Text
                            style={[
                              styles.chipText,
                              entry.categoryId === category.id &&
                                styles.chipTextActive,
                            ]}
                          >
                            {category.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                ) : null}
              </View>
            ))}
          </View>
            </>
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
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.sageDeep,
    textTransform: 'uppercase',
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
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 8,
  },
  categoryName: { color: colors.ink, fontWeight: '600' },
  categoryNameInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontWeight: '700',
    color: colors.ink,
  },
  plannedInput: {
    width: 72,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    textAlign: 'right',
    color: colors.ink,
  },
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
  entryBlock: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 8,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
