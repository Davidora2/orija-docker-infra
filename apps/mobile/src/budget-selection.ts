import AsyncStorage from '@react-native-async-storage/async-storage';

export type BudgetListItem = {
  id: string;
  ownerUserId: string;
  visibility: 'PRIVATE' | 'SHARED';
};

const lastBudgetKeyPrefix = 'life-os-last-budget';

export function lastBudgetStorageKey(userId: string): string {
  return `${lastBudgetKeyPrefix}:${userId}`;
}

export async function loadLastBudgetId(userId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(lastBudgetStorageKey(userId));
  } catch {
    return null;
  }
}

export async function saveLastBudgetId(
  userId: string,
  budgetId: string,
): Promise<void> {
  try {
    await AsyncStorage.setItem(lastBudgetStorageKey(userId), budgetId);
  } catch {
    // Ignore storage failures.
  }
}

/** Prefer a stored or owned personal budget over a newer empty shared space. */
export function pickDefaultBudgetId(
  budgets: BudgetListItem[],
  userId: string,
  options?: { preferredId?: string | null; storedId?: string | null },
): string | null {
  if (!budgets.length) return null;

  const valid = (id?: string | null) =>
    id && budgets.some((budget) => budget.id === id) ? id : null;

  const preferred = valid(options?.preferredId);
  if (preferred) return preferred;

  const stored = valid(options?.storedId);
  if (stored) return stored;

  const ownedPrivate = budgets.filter(
    (budget) =>
      budget.visibility === 'PRIVATE' && budget.ownerUserId === userId,
  );
  if (ownedPrivate.length) return ownedPrivate[0]!.id;

  const owned = budgets.filter((budget) => budget.ownerUserId === userId);
  if (owned.length) return owned[0]!.id;

  return budgets[0]!.id;
}
