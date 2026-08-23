import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Database } from './db.js';

const migrations = [
  {
    version: '001_init',
    path: fileURLToPath(new URL('../migrations/001_init.sql', import.meta.url)),
  },
  {
    version: '002_onboarding_budgets',
    path: fileURLToPath(
      new URL('../migrations/002_onboarding_budgets.sql', import.meta.url),
    ),
  },
  {
    version: '003_pay_schedule_outgoings',
    path: fileURLToPath(
      new URL('../migrations/003_pay_schedule_outgoings.sql', import.meta.url),
    ),
  },
  {
    version: '004_auth_google_reset',
    path: fileURLToPath(
      new URL('../migrations/004_auth_google_reset.sql', import.meta.url),
    ),
  },
  {
    version: '005_wealth_currency',
    path: fileURLToPath(
      new URL('../migrations/005_wealth_currency.sql', import.meta.url),
    ),
  },
  {
    version: '006_bill_payments',
    path: fileURLToPath(
      new URL('../migrations/006_bill_payments.sql', import.meta.url),
    ),
  },
  {
    version: '007_biweekly_recurring',
    path: fileURLToPath(
      new URL('../migrations/007_biweekly_recurring.sql', import.meta.url),
    ),
  },
  {
    version: '008_recurring_notes',
    path: fileURLToPath(
      new URL('../migrations/008_recurring_notes.sql', import.meta.url),
    ),
  },
  {
    version: '009_debts',
    path: fileURLToPath(new URL('../migrations/009_debts.sql', import.meta.url)),
  },
  {
    version: '010_saving_timeline_dashboard',
    path: fileURLToPath(
      new URL('../migrations/010_saving_timeline_dashboard.sql', import.meta.url),
    ),
  },
  {
    version: '011_microsoft_calendar_sync',
    path: fileURLToPath(
      new URL('../migrations/011_microsoft_calendar_sync.sql', import.meta.url),
    ),
  },
  {
    version: '013_email_verification_oauth_link',
    path: fileURLToPath(
      new URL('../migrations/013_email_verification_oauth_link.sql', import.meta.url),
    ),
  },
  {
    version: '014_onboarding_progress',
    path: fileURLToPath(
      new URL('../migrations/014_onboarding_progress.sql', import.meta.url),
    ),
  },
  {
    version: '015_user_profile_body',
    path: fileURLToPath(
      new URL('../migrations/015_user_profile_body.sql', import.meta.url),
    ),
  },
  {
    version: '016_weekly_reviews_privacy',
    path: fileURLToPath(
      new URL('../migrations/016_weekly_reviews_privacy.sql', import.meta.url),
    ),
  },
  {
    version: '017_cleanup_duplicate_empty_budgets',
    path: fileURLToPath(
      new URL('../migrations/017_cleanup_duplicate_empty_budgets.sql', import.meta.url),
    ),
  },
  {
    version: '018_household_money_visibility',
    path: fileURLToPath(
      new URL('../migrations/018_household_money_visibility.sql', import.meta.url),
    ),
  },
  {
    version: '019_payment_budget_entry',
    path: fileURLToPath(
      new URL('../migrations/019_payment_budget_entry.sql', import.meta.url),
    ),
  },
];

export async function runMigrations(sql: Database): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  for (const migration of migrations) {
    const [existing] = await sql<{ version: string }[]>`
      SELECT version FROM schema_migrations WHERE version = ${migration.version}
    `;
    if (existing) continue;

    const source = await readFile(migration.path, 'utf8');
    await sql.begin(async (transaction) => {
      await transaction.unsafe(source);
      await transaction`
        INSERT INTO schema_migrations (version) VALUES (${migration.version})
      `;
    });
  }
}
