import { describe, expect, it } from 'vitest';
import {
  buildRecommendations,
  payDatesInMonth,
  projectRecurringForMonth,
  type OutgoingItem,
  type RecurringOutgoing,
} from './budget-cashflow.js';

describe('budget cashflow helpers', () => {
  it('projects monthly and weekly recurring outgoings onto a month', () => {
    const recurring: RecurringOutgoing[] = [
      {
        id: 'rent',
        budgetId: 'b1',
        categoryId: null,
        name: 'Rent',
        amountCents: 120_000,
        cadence: 'monthly',
        dayOfMonth: 1,
        weekday: null,
        active: true,
      },
      {
        id: 'gym',
        budgetId: 'b1',
        categoryId: null,
        name: 'Gym',
        amountCents: 2_500,
        cadence: 'weekly',
        dayOfMonth: null,
        weekday: 1,
        active: true,
      },
    ];

    const items = projectRecurringForMonth(2026, 8, recurring);
    expect(items.some((item) => item.title === 'Rent' && item.date === '2026-08-01')).toBe(
      true,
    );
    expect(items.filter((item) => item.title === 'Gym').length).toBeGreaterThanOrEqual(4);
  });

  it('lists monthly payday from next pay date', () => {
    expect(payDatesInMonth(2026, 8, 'monthly', '2026-08-28')).toEqual(['2026-08-28']);
  });

  it('recommends moving bills that land before payday', () => {
    const base = {
      note: '',
      categoryId: null as string | null,
      categoryName: null as string | null,
      savingGoalId: null as string | null,
      paid: false,
      paidAt: null as string | null,
      paymentId: null as string | null,
    };
    const list: OutgoingItem[] = [
      {
        ...base,
        id: '1',
        source: 'recurring',
        kind: 'EXPENSE',
        date: '2026-08-20',
        amountCents: 80_000,
        title: 'Rent',
        recurringId: 'r1',
      },
      {
        ...base,
        id: '2',
        source: 'entry',
        kind: 'EXPENSE',
        date: '2026-08-21',
        amountCents: 4_000,
        title: 'Food',
        note: 'food',
        categoryName: 'Food',
        recurringId: null,
      },
      {
        ...base,
        id: '3',
        source: 'entry',
        kind: 'EXPENSE',
        date: '2026-08-22',
        amountCents: 3_500,
        title: 'Food',
        note: 'food',
        categoryName: 'Food',
        recurringId: null,
      },
      {
        ...base,
        id: '4',
        source: 'entry',
        kind: 'EXPENSE',
        date: '2026-08-23',
        amountCents: 2_000,
        title: 'Food',
        note: 'food',
        categoryName: 'Food',
        recurringId: null,
      },
      {
        ...base,
        id: '5',
        source: 'entry',
        kind: 'EXPENSE',
        date: '2026-08-24',
        amountCents: 2_500,
        title: 'Food',
        note: 'food',
        categoryName: 'Food',
        recurringId: null,
      },
    ];

    const recommendations = buildRecommendations({
      currency: 'GBP',
      payFrequency: 'monthly',
      typicalPayCents: 200_000,
      payDates: ['2026-08-28'],
      list,
      recurring: [
        {
          id: 'r1',
          budgetId: 'b1',
          categoryId: null,
          name: 'Rent',
          amountCents: 80_000,
          cadence: 'monthly',
          dayOfMonth: 20,
          weekday: null,
          active: true,
        },
      ],
    });

    expect(recommendations.some((item) => item.id === 'bills-before-payday')).toBe(true);
    expect(recommendations.some((item) => item.id === 'frequent-spend-envelope')).toBe(true);
  });
});
