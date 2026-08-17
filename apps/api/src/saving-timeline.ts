/** Timeline helpers for saving goals. */

export function monthsBetweenInclusive(
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
): number {
  return (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
}

/** Whole months left from "today" to target date (minimum 1 if target is in the future). */
export function monthsRemainingToTarget(
  targetDate: string,
  today: Date = new Date(),
): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(targetDate);
  if (!match) return 0;
  const targetYear = Number(match[1]);
  const targetMonth = Number(match[2]);
  const fromYear = today.getUTCFullYear();
  const fromMonth = today.getUTCMonth() + 1;
  const months = monthsBetweenInclusive(
    fromYear,
    fromMonth,
    targetYear,
    targetMonth,
  );
  return Math.max(0, months);
}

export function requiredMonthlyContributionCents(input: {
  targetCents: number;
  currentCents: number;
  targetDate: string | null;
  today?: Date;
}): {
  monthsRemaining: number | null;
  remainingCents: number;
  requiredMonthlyCents: number | null;
} {
  const remainingCents = Math.max(0, input.targetCents - input.currentCents);
  if (!input.targetDate) {
    return {
      monthsRemaining: null,
      remainingCents,
      requiredMonthlyCents: null,
    };
  }
  const monthsRemaining = monthsRemainingToTarget(
    input.targetDate,
    input.today ?? new Date(),
  );
  if (monthsRemaining <= 0) {
    return {
      monthsRemaining: 0,
      remainingCents,
      requiredMonthlyCents: remainingCents > 0 ? remainingCents : 0,
    };
  }
  return {
    monthsRemaining,
    remainingCents,
    requiredMonthlyCents: Math.ceil(remainingCents / monthsRemaining),
  };
}

export function contributionShortfallCents(input: {
  requiredMonthlyCents: number | null;
  monthlyContributionCents: number | null;
}): number {
  if (input.requiredMonthlyCents == null) return 0;
  const planned = input.monthlyContributionCents ?? 0;
  return Math.max(0, input.requiredMonthlyCents - planned);
}
