import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import type { AppConfig } from './config.js';
import { createDatabase, type Database } from './db.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;

suite('registration email guard', () => {
  let sql: Database;
  let app: Awaited<ReturnType<typeof buildApp>>;

  const config: AppConfig = {
    nodeEnv: 'production',
    host: '127.0.0.1',
    port: 4000,
    databaseUrl: databaseUrl!,
    jwtSecret: 'test-secret-that-is-at-least-thirty-two-characters',
    appOrigins: ['https://lifeos.orija.store'],
    publicAppUrl: 'https://lifeos.orija.store',
    accessTokenTtl: '15m',
    refreshTokenDays: 30,
    autoMigrate: true,
    googleClientIds: [],
    googleOauthClientSecret: null,
    microsoftClientId: null,
    microsoftClientSecret: null,
    microsoftTenantId: 'common',
    calendarTokenEncryptionKey: null,
    resendApiKey: null,
    emailFrom: 'Life OS <test@example.com>',
    smtpUser: null,
    smtpAppPassword: null,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    authDebugCodes: false,
    authEmailVerificationDisabled: false,
    skipEmailSend: false,
    allowTestRegistrationEmails: false,
  };

  beforeAll(async () => {
    sql = createDatabase(databaseUrl!);
    app = await buildApp(config, {
      sql,
      logger: false,
      runSchemaMigrations: true,
    });
  });

  beforeEach(async () => {
    await sql`
      TRUNCATE TABLE
        auth_codes,
        refresh_tokens,
        household_members,
        households,
        users
      CASCADE
    `;
  });

  afterAll(async () => {
    await app.close();
    await sql.end();
  });

  async function attemptRegister(email: string) {
    return app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email,
        displayName: 'Blocked User',
        password: 'correct-horse-battery-staple',
        timezone: 'UTC',
        deviceName: 'vitest',
      },
    });
  }

  it('rejects dark-heroes addresses on orija.store before creating a user', async () => {
    const response = await attemptRegister('dark-heroes-1787436678@orija.store');
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: 'registration_email_blocked',
    });

    const [user] = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM users WHERE email = 'dark-heroes-1787436678@orija.store'
    `;
    expect(user?.count).toBe('0');
  });

  it('rejects audit-ui addresses on example.com', async () => {
    const response = await attemptRegister('audit-ui-123@example.com');
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: 'registration_email_blocked',
    });
  });

  it('rejects agent-style local parts on real domains', async () => {
    const response = await attemptRegister('test-agent@proton.me');
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: 'registration_email_blocked',
    });
  });
});
