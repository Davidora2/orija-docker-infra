import { describe, expect, it } from 'vitest';
import { estimatedMonthlyInterestCents } from './wealth.js';

describe('debt interest helpers', () => {
  it('estimates monthly interest from APR', () => {
    // £1,000 at 12% APR ≈ £10/month
    expect(estimatedMonthlyInterestCents(100_000, 12)).toBe(1_000);
  });

  it('returns zero when balance or APR is zero', () => {
    expect(estimatedMonthlyInterestCents(0, 12)).toBe(0);
    expect(estimatedMonthlyInterestCents(100_000, 0)).toBe(0);
  });
});
