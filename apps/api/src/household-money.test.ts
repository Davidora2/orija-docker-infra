import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import type { AppConfig } from './config.js';
import { createDatabase, type Database } from './db.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;

suite('household money visibility API', () => {
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
    googleClientIds: ['test-google-client'],
    googleOauthClientSecret: null,
    microsoftClientId: 'test-microsoft-client',
    microsoftClientSecret: null,
    microsoftTenantId: 'common',
    calendarTokenEncryptionKey: null,
    resendApiKey: null,
    emailFrom: 'Life OS <test@example.com>',
    smtpUser: null,
    smtpAppPassword: null,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    authDebugCodes: true,
    authEmailVerificationDisabled: false,
    skipEmailSend: false,
    allowTestRegistrationEmails: true,
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
        budget_entries,
        budget_recurring_outgoings,
        budget_categories,
        budgets,
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

  async function register(email: string, displayName: string) {
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
    const registered = response.json<{
      requiresEmailVerification: boolean;
      debugCode: string;
      email: string;
    }>();
    const verify = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-email',
      payload: { email: registered.email, code: registered.debugCode },
    });
    expect(verify.statusCode).toBe(200);
    return verify.json<{ accessToken: string; account: Record<string, unknown> }>();
  }

  async function linkCouple(ownerToken: string, partnerToken: string) {
    const invite = await app.inject({
      method: 'POST',
      url: '/v1/households/invites',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {},
    });
    expect(invite.statusCode).toBe(201);
    const { token } = invite.json<{ token: string }>();
    const accept = await app.inject({
      method: 'POST',
      url: '/v1/households/invites/accept',
      headers: { authorization: `Bearer ${partnerToken}` },
      payload: { token },
    });
    expect(accept.statusCode).toBe(200);
  }

  it('defaults both members to shared bills only and allows grant updates', async () => {
    const owner = await register('hmv-owner@example.com', 'Owner');
    const partner = await register('hmv-partner@example.com', 'Partner');
    await linkCouple(owner.accessToken, partner.accessToken);

    const ownerMe = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(ownerMe.json()).toMatchObject({
      moneyVisibilityGrant: 'SHARED_BILLS_ONLY',
      partnerMoneyVisibilityGrant: 'SHARED_BILLS_ONLY',
    });

    const updated = await app.inject({
      method: 'PUT',
      url: '/v1/households/members/me/money-visibility',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { grant: 'FULL_VISIBILITY' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      moneyVisibilityGrant: 'FULL_VISIBILITY',
      partnerMoneyVisibilityGrant: 'SHARED_BILLS_ONLY',
    });
  });

  it('moves recurring bills to household without duplicating rows', async () => {
    const owner = await register('hmv-move-owner@example.com', 'Owner');
    const partner = await register('hmv-move-partner@example.com', 'Partner');
    await linkCouple(owner.accessToken, partner.accessToken);

    const personal = await app.inject({
      method: 'POST',
      url: '/v1/budgets',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { name: 'Personal budget', visibility: 'PRIVATE', seedCategories: true },
    });
    const personalBudget = personal.json<{ id: string }>();

    const recurring = await app.inject({
      method: 'POST',
      url: `/v1/budgets/${personalBudget.id}/recurring`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        name: 'Rent',
        amountCents: 120_000,
        cadence: 'monthly',
        dayOfMonth: 1,
      },
    });
    expect(recurring.statusCode).toBe(201);
    const recurringRow = recurring.json<{ id: string }>();

    const move = await app.inject({
      method: 'POST',
      url: `/v1/budgets/${personalBudget.id}/recurring/${recurringRow.id}/move-to-household`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(move.statusCode).toBe(200);

    const personalRecurring = await app.inject({
      method: 'GET',
      url: `/v1/budgets/${personalBudget.id}/recurring`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(personalRecurring.json()).toEqual([]);

    const lens = await app.inject({
      method: 'GET',
      url: '/v1/households/active/money-lens',
      headers: { authorization: `Bearer ${partner.accessToken}` },
    });
    expect(lens.statusCode).toBe(200);
    const payload = lens.json<{
      list: { title: string; sourceVisibility: string }[];
      recurring: { name: string }[];
    }>();
    expect(payload.recurring.map((row) => row.name)).toEqual(['Rent']);
    expect(payload.list.filter((item) => item.title === 'Rent')).toHaveLength(1);
    expect(
      payload.list.filter((item) => item.title === 'Rent')[0]?.sourceVisibility,
    ).toBe('SHARED');
  });

  it('includes partner personal outgoings in household lens when full visibility is granted', async () => {
    const owner = await register('hmv-full-owner@example.com', 'Owner');
    const partner = await register('hmv-full-partner@example.com', 'Partner');
    await linkCouple(owner.accessToken, partner.accessToken);

    const personal = await app.inject({
      method: 'POST',
      url: '/v1/budgets',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { name: 'Personal budget', visibility: 'PRIVATE', seedCategories: true },
    });
    const personalBudget = personal.json<{ id: string }>();

    await app.inject({
      method: 'POST',
      url: `/v1/budgets/${personalBudget.id}/recurring`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        name: 'Gym',
        amountCents: 4_500,
        cadence: 'monthly',
        dayOfMonth: 5,
      },
    });

    await app.inject({
      method: 'PUT',
      url: '/v1/households/members/me/money-visibility',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { grant: 'FULL_VISIBILITY' },
    });

    const partnerLens = await app.inject({
      method: 'GET',
      url: '/v1/households/active/money-lens',
      headers: { authorization: `Bearer ${partner.accessToken}` },
    });
    expect(partnerLens.statusCode).toBe(200);
    const partnerView = partnerLens.json<{
      recurring: { name: string; readOnly: boolean; sourceVisibility: string }[];
    }>();
    expect(partnerView.recurring).toEqual([
      expect.objectContaining({
        name: 'Gym',
        readOnly: true,
        sourceVisibility: 'PRIVATE',
      }),
    ]);

    const ownerLens = await app.inject({
      method: 'GET',
      url: '/v1/households/active/money-lens',
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    const ownerView = ownerLens.json<{
      recurring: { name: string }[];
    }>();
    expect(ownerView.recurring.map((row) => row.name)).toContain('Gym');
  });
});
