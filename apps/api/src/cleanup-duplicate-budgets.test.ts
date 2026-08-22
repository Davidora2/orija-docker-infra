import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('017_cleanup_duplicate_empty_budgets migration', () => {
  it('targets only David-owned empty duplicates from 2026-08-22', () => {
    const sql = readFileSync(
      fileURLToPath(
        new URL('../migrations/017_cleanup_duplicate_empty_budgets.sql', import.meta.url),
      ),
      'utf8',
    );

    expect(sql).toContain("owner_user_id = 'f5d5994a-7883-4894-b77e-8bc226a868cd'");
    expect(sql).toContain("id <> '208eb2bc-78be-494d-9e4f-64b688a32b6e'");
    expect(sql).toContain("name IN ('Personal budget', 'Shared budget')");
    expect(sql).toContain("created_at >= TIMESTAMPTZ '2026-08-22'");
    expect(sql).toContain('budget_entries');
    expect(sql).toContain('budget_recurring_outgoings');
    expect(sql).toContain('typical_pay_cents');
    expect(sql).toContain('pay_frequency IS NULL');
  });
});
