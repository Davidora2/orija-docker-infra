import { pickDefaultBudgetId } from '@life-os/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';

export { pickDefaultBudgetId };

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

