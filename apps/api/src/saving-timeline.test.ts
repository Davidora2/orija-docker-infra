import { describe, expect, it } from 'vitest';
import {
  contributionShortfallCents,
  monthsRemainingToTarget,
  requiredMonthlyContributionCents,
} from './saving-timeline.js';

describe('saving timeline', () => {
  it('divides remaining balance across months to target date', () => {
    const result = requiredMonthlyContributionCents({
      targetCents: 120_000,
      currentCents: 0,
      targetDate: '2027-08-01',
      today: new Date(Date.UTC(2026, 7, 16)), // Aug 2026
    });
    // Aug 2026 .. Aug 2027 inclusive = 13 months
    expect(result.monthsRemaining).toBe(13);
    expect(result.requiredMonthlyCents).toBe(Math.ceil(120_000 / 13));
  });

  it('computes shortfall when planned monthly is lower than required', () => {
    expect(
      contributionShortfallCents({
        requiredMonthlyCents: 10_000,
        monthlyContributionCents: 6_000,
      }),
    ).toBe(4_000);
    expect(
      contributionShortfallCents({
        requiredMonthlyCents: 10_000,
        monthlyContributionCents: 10_000,
      }),
    ).toBe(0);
  });

  it('returns zero months when target is in the past', () => {
    expect(
      monthsRemainingToTarget('2020-01-01', new Date(Date.UTC(2026, 7, 16))),
    ).toBe(0);
  });
});
