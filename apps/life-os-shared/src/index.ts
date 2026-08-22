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
  createdAt?: string;
  payFrequency?: string | null;
  typicalPayCents?: number | null;
  recurringCount?: number | null;
  recurringTotalCents?: number | null;
};

/** Budget with no pay schedule and no active recurring outgoings. */
function isThinBudget(budget: BudgetListItem): boolean {
  const recurringCount = budget.recurringCount ?? 0;
  const recurringTotal = budget.recurringTotalCents ?? 0;
  return (
    !budget.payFrequency &&
    (budget.typicalPayCents == null || budget.typicalPayCents <= 0) &&
    recurringCount <= 0 &&
    recurringTotal <= 0
  );
}

function personalBudgetRichness(budget: BudgetListItem): number {
  let score = 0;
  if (budget.typicalPayCents != null && budget.typicalPayCents > 0) score += 1000;
  if (budget.payFrequency) score += 100;
  const recurringTotal = budget.recurringTotalCents ?? 0;
  if (recurringTotal > 0) score += 500 + recurringTotal / 1000;
  const recurringCount = budget.recurringCount ?? 0;
  if (recurringCount > 0) score += 50 + recurringCount;
  if (budget.createdAt) {
    const created = Date.parse(budget.createdAt);
    if (Number.isFinite(created)) score += -created / 1e15;
  }
  return score;
}

function pickBestOwnedPrivate(
  budgets: BudgetListItem[],
  userId: string,
): BudgetListItem | null {
  const ownedPrivate = budgets.filter(
    (budget) =>
      budget.visibility === "PRIVATE" && budget.ownerUserId === userId,
  );
  if (!ownedPrivate.length) return null;
  return [...ownedPrivate].sort(
    (a, b) => personalBudgetRichness(b) - personalBudgetRichness(a),
  )[0]!;
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

  const bestOwnedPrivate = pickBestOwnedPrivate(budgets, userId);

  const stored = valid(options?.storedId);
  if (stored) {
    if (bestOwnedPrivate) {
      const storedBudget = budgets.find((budget) => budget.id === stored);
      if (
        storedBudget &&
        stored !== bestOwnedPrivate.id &&
        isThinBudget(storedBudget) &&
        !isThinBudget(bestOwnedPrivate)
      ) {
        return bestOwnedPrivate.id;
      }
    }
    return stored;
  }

  if (bestOwnedPrivate) return bestOwnedPrivate.id;

  const owned = budgets.filter((budget) => budget.ownerUserId === userId);
  if (owned.length) return owned[0]!.id;

  return budgets[0]!.id;
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
