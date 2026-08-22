export type AreaHealthTone = "sage" | "amber" | "danger";

export type AreaHealth = {
  label: "Neglected" | "Needs attention" | "On track";
  tone: AreaHealthTone;
  provenance: string;
};

/**
 * Canonical area-health heuristic. Capacity is intentionally measured against
 * the whole week because Areas compete for the same finite weekly budget.
 */
export function areaHealth(
  activeProjectCount: number,
  plannedHours: number,
  availableHours: number,
): AreaHealth {
  if (activeProjectCount === 0) {
    return {
      label: "Neglected",
      tone: "amber",
      provenance: "No active projects",
    };
  }

  if (plannedHours === 0) {
    return {
      label: "Needs attention",
      tone: "amber",
      provenance: "Active work has no time planned",
    };
  }

  const share = availableHours > 0 ? plannedHours / availableHours : 0;
  if (share >= 0.45) {
    return {
      label: "Needs attention",
      tone: share > 1 ? "danger" : "amber",
      provenance: `${Math.round(share * 100)}% of weekly capacity`,
    };
  }

  return {
    label: "On track",
    tone: "sage",
    provenance: "Active work has protected time",
  };
}

export const EVALUATION_DIMENSIONS = [
  { key: "impact", label: "Impact" },
  { key: "effort", label: "Effort" },
  { key: "alignment", label: "Alignment" },
  { key: "timing", label: "Timing" },
] as const;

export type EvaluationDimension = (typeof EVALUATION_DIMENSIONS)[number]["key"];
export type EvaluationScores = Record<EvaluationDimension, number>;

export function clampEvaluationScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(10, value));
}

/**
 * Plot points in label order: top, right, bottom, left. Values stay raw so
 * effort is not inverted or blended into a potentially misleading aggregate.
 */
export type BudgetListItem = {
  id: string;
  ownerUserId: string;
  visibility: "PRIVATE" | "SHARED";
  name?: string;
  currency?: string | null;
  createdAt?: string;
  payFrequency?: string | null;
  typicalPayCents?: number | null;
  entryCount?: number | null;
  recurringCount?: number | null;
  recurringTotalCents?: number | null;
};

/** Drop duplicate rows when the API or cache returns the same budget id twice. */
export function dedupeBudgetsById<T extends { id: string }>(budgets: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const budget of budgets) {
    if (seen.has(budget.id)) continue;
    seen.add(budget.id);
    unique.push(budget);
  }
  return unique;
}

/** Budget with no pay schedule, entries, or active recurring outgoings. */
function isThinBudget(budget: BudgetListItem): boolean {
  const entryCount = budget.entryCount ?? 0;
  const recurringCount = budget.recurringCount ?? 0;
  const recurringTotal = budget.recurringTotalCents ?? 0;
  return (
    !budget.payFrequency &&
    (budget.typicalPayCents == null || budget.typicalPayCents <= 0) &&
    entryCount <= 0 &&
    recurringCount <= 0 &&
    recurringTotal <= 0
  );
}

function normalizeCurrency(currency?: string | null): string | null {
  const normalized = currency?.trim().toUpperCase();
  return normalized ? normalized : null;
}

function personalBudgetRichness(
  budget: BudgetListItem,
  profileCurrency?: string | null,
): number {
  let score = 0;
  if (budget.typicalPayCents != null && budget.typicalPayCents > 0) score += 1000;
  if (budget.payFrequency) score += 100;
  const recurringTotal = budget.recurringTotalCents ?? 0;
  if (recurringTotal > 0) score += 500 + recurringTotal / 1000;
  const recurringCount = budget.recurringCount ?? 0;
  if (recurringCount > 0) score += 50 + recurringCount;
  const entryCount = budget.entryCount ?? 0;
  if (entryCount > 0) score += 40 + entryCount;
  const profile = normalizeCurrency(profileCurrency);
  const budgetCurrency = normalizeCurrency(budget.currency);
  if (profile && budgetCurrency === profile) score += 250;
  if (budget.createdAt) {
    const created = Date.parse(budget.createdAt);
    if (Number.isFinite(created)) score += -created / 1e15;
  }
  return score;
}

function budgetGroupKey(budget: BudgetListItem): string {
  const name = budget.name?.trim().toLowerCase() ?? "";
  return `${budget.ownerUserId}:${budget.visibility}:${name}`;
}

function pickBestOwnedPrivate(
  budgets: BudgetListItem[],
  userId: string,
  profileCurrency?: string | null,
): BudgetListItem | null {
  const ownedPrivate = budgets.filter(
    (budget) =>
      budget.visibility === "PRIVATE" && budget.ownerUserId === userId,
  );
  if (!ownedPrivate.length) return null;
  return [...ownedPrivate].sort(
    (a, b) =>
      personalBudgetRichness(b, profileCurrency) -
      personalBudgetRichness(a, profileCurrency),
  )[0]!;
}

/** Prefer a stored or owned personal budget over a newer empty shared space. */
export function pickDefaultBudgetId(
  budgets: BudgetListItem[],
  userId: string,
  options?: {
    preferredId?: string | null;
    storedId?: string | null;
    currentId?: string | null;
    profileCurrency?: string | null;
  },
): string | null {
  const unique = dedupeBudgetsById(budgets);
  if (!unique.length) return null;

  const profileCurrency = options?.profileCurrency;
  const richness = (budget: BudgetListItem) =>
    personalBudgetRichness(budget, profileCurrency);

  const valid = (id?: string | null) =>
    id && unique.some((budget) => budget.id === id) ? id : null;

  const preferred = valid(options?.preferredId);
  if (preferred) return preferred;

  const current = valid(options?.currentId);
  if (current) return current;

  const bestOwnedPrivate = pickBestOwnedPrivate(unique, userId, profileCurrency);

  const stored = valid(options?.storedId);
  if (stored) {
    const storedBudget = unique.find((budget) => budget.id === stored);
    if (storedBudget && isThinBudget(storedBudget)) {
      if (bestOwnedPrivate && !isThinBudget(bestOwnedPrivate)) {
        return bestOwnedPrivate.id;
      }
      const bestPopulated = [...unique]
        .filter((budget) => !isThinBudget(budget))
        .sort((a, b) => richness(b) - richness(a))[0];
      if (bestPopulated) return bestPopulated.id;
    }
    return stored;
  }

  if (bestOwnedPrivate) return bestOwnedPrivate.id;

  const owned = unique.filter((budget) => budget.ownerUserId === userId);
  if (owned.length) return owned[0]!.id;

  return unique[0]!.id;
}

/** Hide empty duplicate Personal/Shared rows when a richer sibling exists. */
export function dedupeBudgetsForDisplay<T extends BudgetListItem>(
  budgets: T[],
  profileCurrency?: string | null,
): T[] {
  const unique = dedupeBudgetsById(budgets);
  const byGroup = new Map<string, T[]>();
  for (const budget of unique) {
    const key = budgetGroupKey(budget);
    const group = byGroup.get(key) ?? [];
    group.push(budget);
    byGroup.set(key, group);
  }

  const dropIds = new Set<string>();
  for (const group of byGroup.values()) {
    if (group.length <= 1) continue;
    const richest = [...group].sort(
      (a, b) =>
        personalBudgetRichness(b, profileCurrency) -
        personalBudgetRichness(a, profileCurrency),
    )[0]!;
    for (const budget of group) {
      if (budget.id !== richest.id && isThinBudget(budget)) {
        dropIds.add(budget.id);
      }
    }
  }

  return unique.filter((budget) => !dropIds.has(budget.id));
}

/** Map a budget id to the visible row when display dedupe hid a thin duplicate. */
export function resolveVisibleBudgetId(
  budgets: BudgetListItem[],
  budgetId: string | null,
  profileCurrency?: string | null,
): string | null {
  if (!budgetId) return null;
  const unique = dedupeBudgetsById(budgets);
  const visible = dedupeBudgetsForDisplay(unique, profileCurrency);
  if (visible.some((budget) => budget.id === budgetId)) return budgetId;
  const target = unique.find((budget) => budget.id === budgetId);
  if (!target) return budgetId;
  const targetKey = budgetGroupKey(target);
  return visible.find((budget) => budgetGroupKey(budget) === targetKey)?.id ?? budgetId;
}

/** Dedupe list rows and resolve the budget id that should stay selected. */
export function resolveBudgetSelection(
  budgets: BudgetListItem[],
  userId: string,
  options?: {
    preferredId?: string | null;
    storedId?: string | null;
    currentId?: string | null;
    profileCurrency?: string | null;
  },
): {
  budgets: BudgetListItem[];
  displayBudgets: BudgetListItem[];
  selectedId: string | null;
} {
  const unique = dedupeBudgetsById(budgets);
  const profileCurrency = options?.profileCurrency;
  const displayBudgets = dedupeBudgetsForDisplay(unique, profileCurrency);
  const rawSelectedId = pickDefaultBudgetId(unique, userId, {
    ...options,
    profileCurrency,
  });
  return {
    budgets: unique,
    displayBudgets,
    selectedId: resolveVisibleBudgetId(unique, rawSelectedId, profileCurrency),
  };
}

export function evaluationRadarPoints(
  scores: EvaluationScores,
  center = 60,
  radius = 38,
): string {
  const values = EVALUATION_DIMENSIONS.map(({ key }) =>
    clampEvaluationScore(scores[key]),
  );
  return [
    [center, center - (values[0] / 10) * radius],
    [center + (values[1] / 10) * radius, center],
    [center, center + (values[2] / 10) * radius],
    [center - (values[3] / 10) * radius, center],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}
