import { describe, expect, it } from 'vitest';
import { buildOutstandingReminderEmail } from './bill-reminders.js';

describe('bill reminder email', () => {
  it('lists outstanding bills and savings with a total', () => {
    const message = buildOutstandingReminderEmail('David', '2026-08-16', [
      {
        sourceType: 'recurring_outgoing',
        sourceId: 'r1',
        budgetId: 'b1',
        dueDate: '2026-08-16',
        amountCents: 120_000,
        title: 'Rent',
        currency: 'GBP',
      },
      {
        sourceType: 'saving_goal',
        sourceId: 's1',
        budgetId: null,
        dueDate: '2026-08-16',
        amountCents: 20_000,
        title: 'Savings · Emergency',
        currency: 'GBP',
      },
    ]);

    expect(message.subject).toContain('2 outstanding');
    expect(message.text).toContain('Rent');
    expect(message.text).toContain('Emergency');
    expect(message.text).toContain('Total outstanding');
    expect(message.text).toContain('David');
  });
});
