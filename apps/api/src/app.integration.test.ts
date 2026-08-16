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
    googleClientIds: [],
    resendApiKey: null,
    emailFrom: 'Life OS <test@example.com>',
    smtpUser: null,
    smtpAppPassword: null,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    authDebugCodes: true,
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

  async function register(
    email: string,
    displayName: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    account: Record<string, unknown>;
  }> {
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
    const privateItem = privateResponse.json<{ id: string }>();

    const partnerItems = await app.inject({
      method: 'GET',
      url: '/v1/items',
      headers: { authorization: `Bearer ${partner.accessToken}` },
    });
    expect(partnerItems.statusCode).toBe(200);
    const items = partnerItems.json<{ title: string }[]>();
    expect(items.map((item) => item.title)).toEqual(['Plan our shared financial year']);

    const inaccessibleParent = await app.inject({
      method: 'POST',
      url: '/v1/items',
      headers: { authorization: `Bearer ${partner.accessToken}` },
      payload: {
        kind: 'ACTION',
        title: 'Try to attach to a private project',
        visibility: 'PRIVATE',
        parentId: privateItem.id,
      },
    });
    expect(inaccessibleParent.statusCode).toBe(400);
    expect(inaccessibleParent.json<{ error: string }>().error).toBe('invalid_parent');
  });

  it('allows browser preflight and switches the active household', async () => {
    const owner = await register('switch-owner@example.com', 'Switch Owner');
    const partner = await register('switch-partner@example.com', 'Switch Partner');
    const originalHouseholdId = (
      partner.account as { activeHouseholdId: string }
    ).activeHouseholdId;

    const inviteResponse = await app.inject({
      method: 'POST',
      url: '/v1/households/invites',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { invitedEmail: 'switch-partner@example.com' },
    });
    const invite = inviteResponse.json<{ token: string }>();
    await app.inject({
      method: 'POST',
      url: '/v1/households/invites/accept',
      headers: { authorization: `Bearer ${partner.accessToken}` },
      payload: { token: invite.token },
    });

    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/v1/households/active',
      headers: {
        origin: 'http://localhost:3002',
        'access-control-request-method': 'PATCH',
        'access-control-request-headers': 'authorization,content-type',
      },
    });
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe(
      'http://localhost:3002',
    );
    expect(preflight.headers['access-control-allow-methods']).toContain('PATCH');

    const switched = await app.inject({
      method: 'PATCH',
      url: '/v1/households/active',
      headers: { authorization: `Bearer ${partner.accessToken}` },
      payload: { householdId: originalHouseholdId },
    });
    expect(switched.statusCode).toBe(200);
    expect(switched.json<{ activeHouseholdId: string }>().activeHouseholdId).toBe(
      originalHouseholdId,
    );
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

  it('rotates refresh tokens and rejects replay', async () => {
    const user = await register('refresh@example.com', 'Refresh User');

    const firstRefresh = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: {
        refreshToken: user.refreshToken,
        deviceName: 'replacement',
      },
    });
    expect(firstRefresh.statusCode).toBe(200);
    expect(firstRefresh.json<{ refreshToken: string }>().refreshToken).not.toBe(
      user.refreshToken,
    );

    const replay = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: {
        refreshToken: user.refreshToken,
      },
    });
    expect(replay.statusCode).toBe(401);
    expect(replay.json<{ error: string }>().error).toBe('invalid_refresh_token');
  });

  it('completes onboarding areas and supports personal + shared budgets', async () => {
    const owner = await register('budget-owner@example.com', 'Budget Owner');
    const partner = await register('budget-partner@example.com', 'Budget Partner');

    const onboard = await app.inject({
      method: 'POST',
      url: '/v1/onboarding/complete',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        areas: [
          { title: 'Health', icon: 'fitness-outline' },
          { title: 'Wealth', icon: 'wallet-outline' },
        ],
      },
    });
    expect(onboard.statusCode).toBe(200);
    expect(
      onboard.json<{ user: { onboardingCompletedAt: string | null } }>().user
        .onboardingCompletedAt,
    ).toBeTruthy();

    const pillars = await app.inject({
      method: 'GET',
      url: '/v1/items?kind=PILLAR',
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(pillars.statusCode).toBe(200);
    expect(pillars.json<unknown[]>().length).toBe(2);

    const personal = await app.inject({
      method: 'POST',
      url: '/v1/budgets',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { name: 'My money', visibility: 'PRIVATE' },
    });
    expect(personal.statusCode).toBe(201);
    const personalBudget = personal.json<{ id: string; categories: unknown[] }>();
    expect(personalBudget.categories.length).toBeGreaterThan(0);

    const invite = await app.inject({
      method: 'POST',
      url: '/v1/households/invites',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {},
    });
    const token = invite.json<{ token: string }>().token;
    await app.inject({
      method: 'POST',
      url: '/v1/households/invites/accept',
      headers: { authorization: `Bearer ${partner.accessToken}` },
      payload: { token },
    });

    // Owner must use couple household for shared budget
    const ownerAccount = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    const coupleId = ownerAccount
      .json<{ households: { id: string; role: string }[] }>()
      .households.find((household) => household.role === 'OWNER')?.id;
    expect(coupleId).toBeTruthy();
    await app.inject({
      method: 'PATCH',
      url: '/v1/households/active',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { householdId: coupleId },
    });

    const shared = await app.inject({
      method: 'POST',
      url: '/v1/budgets',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { name: 'Ours', visibility: 'SHARED' },
    });
    expect(shared.statusCode).toBe(201);
    const sharedBudget = shared.json<{ id: string }>();

    const partnerList = await app.inject({
      method: 'GET',
      url: '/v1/budgets',
      headers: { authorization: `Bearer ${partner.accessToken}` },
    });
    expect(partnerList.statusCode).toBe(200);
    const partnerBudgets = partnerList.json<{ id: string; visibility: string }[]>();
    expect(partnerBudgets.some((budget) => budget.id === sharedBudget.id)).toBe(true);
    expect(partnerBudgets.some((budget) => budget.id === personalBudget.id)).toBe(
      false,
    );

    const categoryId = personalBudget.categories[0]
      ? (personalBudget.categories[0] as { id: string }).id
      : null;
    const entry = await app.inject({
      method: 'POST',
      url: `/v1/budgets/${personalBudget.id}/entries`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        kind: 'EXPENSE',
        amountCents: 1250,
        categoryId,
        note: 'Coffee',
      },
    });
    expect(entry.statusCode).toBe(201);

    await app.inject({
      method: 'PATCH',
      url: `/v1/budgets/${personalBudget.id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        payFrequency: 'monthly',
        nextPayDate: '2026-08-28',
        typicalPayCents: 250000,
      },
    });

    const recurring = await app.inject({
      method: 'POST',
      url: `/v1/budgets/${personalBudget.id}/recurring`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        name: 'Rent',
        amountCents: 120000,
        cadence: 'monthly',
        dayOfMonth: 1,
      },
    });
    expect(recurring.statusCode).toBe(201);

    const outgoings = await app.inject({
      method: 'GET',
      url: `/v1/budgets/${personalBudget.id}/outgoings?year=2026&month=8`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(outgoings.statusCode).toBe(200);
    const month = outgoings.json<{
      list: unknown[];
      days: unknown[];
      recommendations: { id: string }[];
      paySchedule: { payDates: string[] };
    }>();
    expect(month.days.length).toBe(31);
    expect(month.list.length).toBeGreaterThan(0);
    expect(month.paySchedule.payDates).toContain('2026-08-28');
    expect(month.recommendations.length).toBeGreaterThan(0);
  });

  it('sends a password reset code and resets the password', async () => {
    const user = await register('reset@example.com', 'Reset User');

    const forgot = await app.inject({
      method: 'POST',
      url: '/v1/auth/forgot-password',
      payload: { email: 'reset@example.com' },
    });
    expect(forgot.statusCode).toBe(200);
    const code = forgot.json<{ debugCode?: string }>().debugCode;
    expect(code).toMatch(/^\d{6}$/);

    const verify = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-reset-code',
      payload: { email: 'reset@example.com', code },
    });
    expect(verify.statusCode).toBe(200);

    const reset = await app.inject({
      method: 'POST',
      url: '/v1/auth/reset-password',
      payload: {
        email: 'reset@example.com',
        code,
        newPassword: 'brand-new-password-123',
        deviceName: 'vitest',
      },
    });
    expect(reset.statusCode).toBe(200);
    expect(reset.json<{ accessToken: string }>().accessToken).toBeTruthy();

    const oldLogin = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        email: 'reset@example.com',
        password: 'correct-horse-battery-staple',
        deviceName: 'vitest',
      },
    });
    expect(oldLogin.statusCode).toBe(401);

    const newLogin = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        email: 'reset@example.com',
        password: 'brand-new-password-123',
        deviceName: 'vitest',
      },
    });
    expect(newLogin.statusCode).toBe(200);
    void user;
  });

  it('tracks savings, investments, net worth, currency and draft expenses', async () => {
    const user = await register('wealth@example.com', 'Wealth User');

    const onboard = await app.inject({
      method: 'POST',
      url: '/v1/onboarding/complete',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        areas: [{ title: 'Wealth', icon: 'wallet-outline' }],
        preferredCurrency: 'CAD',
      },
    });
    expect(onboard.statusCode).toBe(200);
    expect(
      onboard.json<{ user: { preferredCurrency: string } }>().user.preferredCurrency,
    ).toBe('CAD');

    const saving = await app.inject({
      method: 'POST',
      url: '/v1/saving-goals',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        name: 'Rainy day',
        category: 'emergency',
        targetCents: 500_000,
        currentCents: 120_000,
      },
    });
    expect(saving.statusCode).toBe(201);

    const investment = await app.inject({
      method: 'POST',
      url: '/v1/investments',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        name: 'TFSA Growth',
        accountType: 'tfsa',
        goalCents: 1_000_000,
        currentCents: 250_000,
      },
    });
    expect(investment.statusCode).toBe(201);

    const netWorth = await app.inject({
      method: 'GET',
      url: '/v1/net-worth',
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    expect(netWorth.statusCode).toBe(200);
    const wealth = netWorth.json<{
      currency: string;
      personal: { netWorthCents: number; savingsCents: number; investmentsCents: number };
    }>();
    expect(wealth.currency).toBe('CAD');
    expect(wealth.personal.savingsCents).toBe(120_000);
    expect(wealth.personal.investmentsCents).toBe(250_000);
    expect(wealth.personal.netWorthCents).toBeGreaterThanOrEqual(370_000);

    const budget = await app.inject({
      method: 'POST',
      url: '/v1/budgets',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { name: 'CAD budget', visibility: 'PRIVATE' },
    });
    expect(budget.statusCode).toBe(201);
    const budgetId = budget.json<{ id: string; currency: string }>().id;
    expect(budget.json<{ currency: string }>().currency).toBe('CAD');

    await app.inject({
      method: 'PATCH',
      url: `/v1/budgets/${budgetId}`,
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        payFrequency: 'monthly',
        nextPayDate: '2026-08-28',
        typicalPayCents: 400_000,
      },
    });

    const draft = await app.inject({
      method: 'POST',
      url: `/v1/budgets/${budgetId}/drafts`,
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { name: 'New gym', amountCents: 80_00 },
    });
    expect(draft.statusCode).toBe(201);

    const impact = await app.inject({
      method: 'GET',
      url: `/v1/budgets/${budgetId}/draft-impact`,
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    expect(impact.statusCode).toBe(200);
    expect(
      impact.json<{ impact: { draftCents: number } }>().impact.draftCents,
    ).toBe(80_00);

    const profile = await app.inject({
      method: 'PATCH',
      url: '/v1/me',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { preferredCurrency: 'GBP' },
    });
    expect(profile.statusCode).toBe(200);
    expect(
      profile.json<{ user: { preferredCurrency: string } }>().user.preferredCurrency,
    ).toBe('GBP');
  });
});
