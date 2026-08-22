const lastBudgetKeyPrefix = "life-os-last-budget";

export function lastBudgetStorageKey(userId: string): string {
  return `${lastBudgetKeyPrefix}:${userId}`;
}

export function loadLastBudgetId(userId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(lastBudgetStorageKey(userId));
  } catch {
    return null;
  }
}

export function saveLastBudgetId(userId: string, budgetId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(lastBudgetStorageKey(userId), budgetId);
  } catch {
    // Ignore quota / private-mode failures.
  }
}
