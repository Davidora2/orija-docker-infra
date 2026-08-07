import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import type { AppConfig } from './config.js';
import { createDatabase, type Database } from './db.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;

suite('account and couple household API', () => {
  let sql: Database;
  let app: Awaited<ReturnType<typeof buildApp>>;

  const config: AppConfig = {
    nodeEnv: 'test',
    host: '127.0.0.1',
    port: 4000,
    databaseUrl: databaseUrl!,
    jwtSecret: 'test-secret-that-is-at-least-thirty-two-characters',
    appOrigins: ['http://localhost:3002'],
    publicAppUrl: 'http://localhost:3001',
    accessTokenTtl: '15m',
    refreshTokenDays: 30,
    autoMigrate: true,
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
        life_items,
        refresh_tokens,
        household_invites,
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

  async function register(
    email: string,
    displayName: string,
  ): Promise<{ accessToken: string; account: Record<string, unknown> }> {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email,
        displayName,
        password: 'correct-horse-battery-staple',
        timezone: 'Europe/London',
        deviceName: 'vitest',
      },
    });
    expect(response.statusCode).toBe(201);
    return response.json();
  }

  it('links two accounts while preserving private items', async () => {
    const owner = await register('owner@example.com', 'Owner');
    const partner = await register('partner@example.com', 'Partner');

    const inviteResponse = await app.inject({
      method: 'POST',
      url: '/v1/households/invites',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { invitedEmail: 'partner@example.com' },
    });
    expect(inviteResponse.statusCode).toBe(201);
    const invite = inviteResponse.json<{ token: string }>();

    const acceptResponse = await app.inject({
      method: 'POST',
      url: '/v1/households/invites/accept',
      headers: { authorization: `Bearer ${partner.accessToken}` },
      payload: { token: invite.token },
    });
    expect(acceptResponse.statusCode).toBe(200);
    expect(acceptResponse.json<{ members: unknown[] }>().members).toHaveLength(2);

    const sharedResponse = await app.inject({
      method: 'POST',
      url: '/v1/items',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        kind: 'GOAL',
        title: 'Plan our shared financial year',
        visibility: 'SHARED',
      },
    });
    expect(sharedResponse.statusCode).toBe(201);

    const privateResponse = await app.inject({
      method: 'POST',
      url: '/v1/items',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        kind: 'IDEA',
        title: 'Private birthday surprise',
        visibility: 'PRIVATE',
      },
    });
    expect(privateResponse.statusCode).toBe(201);

    const partnerItems = await app.inject({
      method: 'GET',
      url: '/v1/items',
      headers: { authorization: `Bearer ${partner.accessToken}` },
    });
    expect(partnerItems.statusCode).toBe(200);
    const items = partnerItems.json<{ title: string }[]>();
    expect(items.map((item) => item.title)).toEqual(['Plan our shared financial year']);
  });

  it('does not allow a third member into a couple household', async () => {
    const owner = await register('owner@example.com', 'Owner');
    const partner = await register('partner@example.com', 'Partner');
    const third = await register('third@example.com', 'Third');

    const firstInvite = await app.inject({
      method: 'POST',
      url: '/v1/households/invites',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { invitedEmail: 'partner@example.com' },
    });
    await app.inject({
      method: 'POST',
      url: '/v1/households/invites/accept',
      headers: { authorization: `Bearer ${partner.accessToken}` },
      payload: { token: firstInvite.json<{ token: string }>().token },
    });

    const secondInvite = await app.inject({
      method: 'POST',
      url: '/v1/households/invites',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { invitedEmail: 'third@example.com' },
    });
    expect(secondInvite.statusCode).toBe(409);

    const thirdAccount = third.account;
    expect(thirdAccount).toBeTruthy();
  });
});
