import { loadConfig } from './config.js';
import { createDatabase } from './db.js';
import { runMigrations } from './migrations.js';

const config = loadConfig();
const sql = createDatabase(config.databaseUrl);

try {
  await runMigrations(sql);
  console.info('Life OS database migrations are up to date.');
} finally {
  await sql.end();
}
