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
