import postgres from 'postgres';

export type Database = ReturnType<typeof postgres>;

export function createDatabase(databaseUrl: string): Database {
  return postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    transform: postgres.camel,
  });
}
