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
    const registered = response.json<{
      requiresEmailVerification: boolean;
      debugCode: string;
      email: string;
    }>();
    expect(registered.requiresEmailVerification).toBe(true);
    expect(registered.debugCode).toBeTruthy();

    const verify = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-email',
      payload: {
        email,
        code: registered.debugCode,
        deviceName: 'vitest',
      },
    });
    expect(verify.statusCode).toBe(200);
    return verify.json();
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

  it('persists resumable onboarding progress without completing early', async () => {
    const user = await register('onboarding-progress@example.com', 'Progress User');
    const initial = user.account as {
      user: {
        onboardingCompletedAt: string | null;
        onboardingStep: string | null;
      };
    };
    expect(initial.user.onboardingCompletedAt).toBeNull();
    expect(initial.user.onboardingStep).toBe('welcome');

    const progress = await app.inject({
      method: 'PATCH',
      url: '/v1/onboarding/progress',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { step: 'areas' },
    });
    expect(progress.statusCode).toBe(200);
    expect(
      progress.json<{ user: { onboardingStep: string } }>().user.onboardingStep,
    ).toBe('areas');

    const areas = await app.inject({
      method: 'POST',
      url: '/v1/onboarding/complete',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        areas: [{ title: 'Health', icon: 'fitness-outline' }],
        preferredCurrency: 'GBP',
        complete: false,
        nextStep: 'capacity',
      },
    });
    expect(areas.statusCode).toBe(200);
    expect(
      areas.json<{
        user: {
          onboardingCompletedAt: string | null;
          onboardingStep: string | null;
        };
      }>().user,
    ).toMatchObject({
      onboardingCompletedAt: null,
      onboardingStep: 'capacity',
    });

    const complete = await app.inject({
      method: 'POST',
      url: '/v1/onboarding/complete',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        areas: [{ title: 'Health', icon: 'fitness-outline' }],
        complete: true,
      },
    });
    expect(complete.statusCode).toBe(200);
    const completedUser = complete.json<{
      user: {
        onboardingCompletedAt: string | null;
        onboardingStep: string | null;
      };
    }>().user;
    expect(completedUser.onboardingCompletedAt).toBeTruthy();
    expect(completedUser.onboardingStep).toBeNull();

    const ignored = await app.inject({
      method: 'PATCH',
      url: '/v1/onboarding/progress',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { step: 'ideas' },
    });
    expect(ignored.statusCode).toBe(200);
    expect(
      ignored.json<{ user: { onboardingStep: string | null } }>().user
        .onboardingStep,
    ).toBeNull();
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

    const biweekly = await app.inject({
      method: 'POST',
      url: `/v1/budgets/${personalBudget.id}/recurring`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        name: 'Car finance',
        amountCents: 22000,
        cadence: 'biweekly',
        anchorDate: '2026-08-07',
      },
    });
    expect(biweekly.statusCode).toBe(201);

    const outgoings = await app.inject({
      method: 'GET',
      url: `/v1/budgets/${personalBudget.id}/outgoings?year=2026&month=8`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(outgoings.statusCode).toBe(200);
    const month = outgoings.json<{
      list: { title: string; date: string; source?: string }[];
      days: unknown[];
      recommendations: { id: string }[];
      paySchedule: { payDates: string[] };
      totals: {
        expenseCents: number;
        dailyExpenseCents: number;
        recurringCents: number;
        expectedPayCents: number | null;
        deltaCents: number | null;
      };
    }>();
    expect(month.days.length).toBe(31);
    expect(month.list.length).toBeGreaterThan(0);
    expect(month.paySchedule.payDates).toContain('2026-08-28');
    expect(month.recommendations.length).toBeGreaterThan(0);
    expect(month.totals.dailyExpenseCents).toBe(1250);
    expect(month.totals.expectedPayCents).toBe(250_000);
    expect(month.totals.deltaCents).toBe(
      250_000 - month.totals.expenseCents,
    );
    expect(
      month.list.filter((item) => item.title === 'Car finance').map((item) => item.date),
    ).toEqual(['2026-08-07', '2026-08-21']);

    const moved = await app.inject({
      method: 'PATCH',
      url: `/v1/budgets/${personalBudget.id}/recurring/${biweekly.json<{ id: string }>().id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        anchorDate: '2026-08-14',
        note: 'From current account',
      },
    });
    expect(moved.statusCode).toBe(200);
    expect(moved.json<{ note: string; anchorDate?: string }>().note).toBe(
      'From current account',
    );

    const afterMove = await app.inject({
      method: 'GET',
      url: `/v1/budgets/${personalBudget.id}/outgoings?year=2026&month=8`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(
      afterMove
        .json<{ list: { title: string; date: string; note: string }[] }>()
        .list.filter((item) => item.title === 'Car finance')
        .map((item) => item.date),
    ).toEqual(['2026-08-14', '2026-08-28']);
  });

  it('tracks bill payments and sends outstanding reminders', async () => {
    const user = await register('bills@example.com', 'Bills User');
    const onboard = await app.inject({
      method: 'POST',
      url: '/v1/onboarding/complete',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        areas: [{ title: 'Wealth', icon: 'wallet-outline' }],
        preferredCurrency: 'GBP',
      },
    });
    expect(onboard.statusCode).toBe(200);

    const budget = await app.inject({
      method: 'POST',
      url: '/v1/budgets',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { name: 'Bills budget', visibility: 'PRIVATE' },
    });
    expect(budget.statusCode).toBe(201);
    const budgetId = budget.json<{ id: string }>().id;

    const today = new Date();
    const year = today.getUTCFullYear();
    const month = today.getUTCMonth() + 1;
    const day = Math.min(today.getUTCDate(), 28);

    const recurring = await app.inject({
      method: 'POST',
      url: `/v1/budgets/${budgetId}/recurring`,
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        name: 'Council tax',
        amountCents: 15_000,
        cadence: 'monthly',
        dayOfMonth: day,
      },
    });
    expect(recurring.statusCode).toBe(201);
    const recurringId = recurring.json<{ id: string }>().id;

    const goal = await app.inject({
      method: 'POST',
      url: '/v1/saving-goals',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        name: 'Emergency',
        category: 'emergency',
        targetCents: 300_000,
        currentCents: 0,
        monthlyContributionCents: 25_000,
        contributionDay: day,
      },
    });
    expect(goal.statusCode).toBe(201);
    const goalId = goal.json<{ id: string }>().id;

    const dueDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const outgoings = await app.inject({
      method: 'GET',
      url: `/v1/budgets/${budgetId}/outgoings?year=${year}&month=${month}`,
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    expect(outgoings.statusCode).toBe(200);
    const monthData = outgoings.json<{
      list: {
        source: string;
        paid: boolean;
        recurringId: string | null;
        savingGoalId: string | null;
        date: string;
      }[];
      totals: { outstandingCents: number };
    }>();
    expect(monthData.totals.outstandingCents).toBeGreaterThanOrEqual(40_000);
    const bill = monthData.list.find(
      (item) => item.recurringId === recurringId && item.date === dueDate,
    );
    const savings = monthData.list.find(
      (item) => item.savingGoalId === goalId && item.date === dueDate,
    );
    expect(bill?.paid).toBe(false);
    expect(savings?.paid).toBe(false);

    const markBill = await app.inject({
      method: 'POST',
      url: `/v1/budgets/${budgetId}/payments`,
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        sourceType: 'recurring_outgoing',
        sourceId: recurringId,
        dueDate,
      },
    });
    expect(markBill.statusCode).toBe(201);

    const afterPay = await app.inject({
      method: 'GET',
      url: `/v1/budgets/${budgetId}/outgoings?year=${year}&month=${month}`,
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    const paidBill = afterPay
      .json<{ list: { recurringId: string | null; paid: boolean; paymentId: string | null }[] }>()
      .list.find((item) => item.recurringId === recurringId);
    expect(paidBill?.paid).toBe(true);
    expect(paidBill?.paymentId).toBeTruthy();

    const reminder = await app.inject({
      method: 'POST',
      url: '/v1/payments/reminders/run',
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    expect(reminder.statusCode).toBe(200);
    const reminderBody = reminder.json<{
      sent: boolean;
      itemCount: number;
      dueDate: string;
    }>();
    // Savings still outstanding for today in Europe/London (may differ from UTC day)
    expect(reminderBody.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    if (reminderBody.dueDate === dueDate) {
      expect(reminderBody.sent).toBe(true);
      expect(reminderBody.itemCount).toBeGreaterThanOrEqual(1);
    }

    const reminderAgain = await app.inject({
      method: 'POST',
      url: '/v1/payments/reminders/run',
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    expect(reminderAgain.json<{ sent: boolean }>().sent).toBe(false);

    const unmark = await app.inject({
      method: 'DELETE',
      url: `/v1/budgets/${budgetId}/payments/${paidBill!.paymentId}`,
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    expect(unmark.statusCode).toBe(204);
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
    const savingId = saving.json<{ id: string }>().id;

    const savingEdit = await app.inject({
      method: 'PATCH',
      url: `/v1/saving-goals/${savingId}`,
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        name: 'Emergency fund',
        targetCents: 600_000,
        currentCents: 150_000,
        monthlyContributionCents: 25_000,
        contributionDay: 5,
      },
    });
    expect(savingEdit.statusCode).toBe(200);
    expect(savingEdit.json<{ name: string; currentCents: number }>().name).toBe(
      'Emergency fund',
    );
    expect(savingEdit.json<{ currentCents: number }>().currentCents).toBe(150_000);

    const timeline = await app.inject({
      method: 'PATCH',
      url: `/v1/saving-goals/${savingId}`,
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        targetDate: '2027-08-01',
        applyTimelineToMonthly: true,
      },
    });
    expect(timeline.statusCode).toBe(200);
    const timed = timeline.json<{
      requiredMonthlyCents: number;
      monthlyContributionCents: number;
      shortfallCents: number;
      monthsRemaining: number;
    }>();
    expect(timed.monthsRemaining).toBeGreaterThan(0);
    expect(timed.requiredMonthlyCents).toBeGreaterThan(0);
    expect(timed.monthlyContributionCents).toBe(timed.requiredMonthlyCents);
    expect(timed.shortfallCents).toBe(0);

    const underfunded = await app.inject({
      method: 'PATCH',
      url: `/v1/saving-goals/${savingId}`,
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        monthlyContributionCents: Math.max(
          1,
          Math.floor(timed.requiredMonthlyCents / 2),
        ),
        contributionDay: 5,
      },
    });
    expect(underfunded.statusCode).toBe(200);
    expect(
      underfunded.json<{ shortfallCents: number }>().shortfallCents,
    ).toBeGreaterThan(0);

    const gap = await app.inject({
      method: 'GET',
      url: '/v1/wealth/gap-summary',
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    expect(gap.statusCode).toBe(200);
    expect(
      gap.json<{ totalShortfallCents: number }>().totalShortfallCents,
    ).toBeGreaterThan(0);

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
    const investmentId = investment.json<{ id: string }>().id;

    const investmentEdit = await app.inject({
      method: 'PATCH',
      url: `/v1/investments/${investmentId}`,
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        name: 'House FHSA',
        accountType: 'fhsa',
        goalCents: 600_000,
        currentCents: 115_000,
      },
    });
    expect(investmentEdit.statusCode).toBe(200);
    expect(investmentEdit.json<{ name: string }>().name).toBe('House FHSA');
    expect(investmentEdit.json<{ currentCents: number }>().currentCents).toBe(
      115_000,
    );

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
    expect(wealth.personal.savingsCents).toBe(150_000);
    expect(wealth.personal.investmentsCents).toBe(115_000);
    expect(wealth.personal.netWorthCents).toBeGreaterThanOrEqual(265_000);

    const budget = await app.inject({
      method: 'POST',
      url: '/v1/budgets',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { name: 'CAD budget', visibility: 'PRIVATE' },
    });
    expect(budget.statusCode).toBe(201);
    const budgetId = budget.json<{ id: string; currency: string }>().id;
    expect(budget.json<{ currency: string }>().currency).toBe('CAD');

    const series = await app.inject({
      method: 'GET',
      url: `/v1/budgets/${budgetId}/cashflow-series?months=3`,
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    expect(series.statusCode).toBe(200);
    expect(series.json<{ series: unknown[] }>().series).toHaveLength(3);

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

  it('tracks debts with interest and monthly payments', async () => {
    const user = await register('debts@example.com', 'Debt User');
    await app.inject({
      method: 'POST',
      url: '/v1/onboarding/complete',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        areas: [{ title: 'Wealth', icon: 'wallet-outline' }],
        preferredCurrency: 'GBP',
      },
    });

    const create = await app.inject({
      method: 'POST',
      url: '/v1/debts',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        name: 'Barclaycard',
        debtType: 'credit_card',
        balanceCents: 100_000,
        interestAprPercent: 12,
        monthlyPaymentCents: 20_000,
        paymentDay: 15,
        note: 'From current account',
      },
    });
    expect(create.statusCode).toBe(201);
    const debtId = create.json<{ id: string }>().id;

    const list = await app.inject({
      method: 'GET',
      url: '/v1/debts',
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    expect(list.statusCode).toBe(200);
    const debts = list.json<
      {
        id: string;
        estimatedMonthlyInterestCents: number;
        monthlyPaymentCents: number;
      }[]
    >();
    expect(debts[0]?.estimatedMonthlyInterestCents).toBe(1_000);

    const interest = await app.inject({
      method: 'POST',
      url: `/v1/debts/${debtId}/accrue-interest`,
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    expect(interest.statusCode).toBe(200);
    expect(interest.json<{ interestCents: number }>().interestCents).toBe(1_000);

    const budget = await app.inject({
      method: 'POST',
      url: '/v1/budgets',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { name: 'Debt budget', visibility: 'PRIVATE' },
    });
    const budgetId = budget.json<{ id: string }>().id;
    const outgoings = await app.inject({
      method: 'GET',
      url: `/v1/budgets/${budgetId}/outgoings?year=2026&month=8`,
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    expect(outgoings.statusCode).toBe(200);
    const debtItem = outgoings
      .json<{ list: { title: string; date: string; debtId?: string }[] }>()
      .list.find((item) => item.debtId === debtId);
    expect(debtItem?.date).toBe('2026-08-15');

    const paid = await app.inject({
      method: 'POST',
      url: `/v1/budgets/${budgetId}/payments`,
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        sourceType: 'debt',
        sourceId: debtId,
        dueDate: '2026-08-15',
      },
    });
    expect(paid.statusCode).toBe(201);

    const after = await app.inject({
      method: 'GET',
      url: '/v1/debts',
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    // 100000 + 1000 interest - 20000 payment
    expect(after.json<{ balanceCents: number }[]>()[0]?.balanceCents).toBe(81_000);

    const netWorth = await app.inject({
      method: 'GET',
      url: '/v1/net-worth',
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    expect(
      netWorth.json<{ personal: { debtsCents: number } }>().personal.debtsCents,
    ).toBe(81_000);
  });

  it('creates budget categories and updates entry categories', async () => {
    const user = await register('categories@example.com', 'Category User');
    await app.inject({
      method: 'POST',
      url: '/v1/onboarding/complete',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        areas: [{ title: 'Wealth', icon: 'wallet-outline' }],
        preferredCurrency: 'GBP',
      },
    });

    const budgetRes = await app.inject({
      method: 'POST',
      url: '/v1/budgets',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        name: 'Personal budget',
        visibility: 'PRIVATE',
        currency: 'GBP',
        period: 'monthly',
        seedCategories: true,
      },
    });
    expect(budgetRes.statusCode).toBe(201);
    const budget = budgetRes.json<{
      id: string;
      categories: { id: string; name: string }[];
    }>();
    const firstCategoryId = budget.categories[0]?.id;
    expect(firstCategoryId).toBeTruthy();

    const createdCategory = await app.inject({
      method: 'POST',
      url: `/v1/budgets/${budget.id}/categories`,
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { name: 'Pets', plannedCents: 5000 },
    });
    expect(createdCategory.statusCode).toBe(201);
    const petsId = createdCategory.json<{ id: string; name: string }>().id;
    expect(createdCategory.json<{ name: string }>().name).toBe('Pets');

    const entry = await app.inject({
      method: 'POST',
      url: `/v1/budgets/${budget.id}/entries`,
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        kind: 'EXPENSE',
        amountCents: 2500,
        categoryId: firstCategoryId,
        note: 'Vet treats',
      },
    });
    expect(entry.statusCode).toBe(201);
    const entryId = entry.json<{ id: string }>().id;

    const updated = await app.inject({
      method: 'PATCH',
      url: `/v1/budgets/${budget.id}/entries/${entryId}`,
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { categoryId: petsId },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json<{ categoryId: string }>().categoryId).toBe(petsId);

    const cleared = await app.inject({
      method: 'PATCH',
      url: `/v1/budgets/${budget.id}/entries/${entryId}`,
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { categoryId: null },
    });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json<{ categoryId: string | null }>().categoryId).toBeNull();

    const detail = await app.inject({
      method: 'GET',
      url: `/v1/budgets/${budget.id}`,
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    expect(detail.statusCode).toBe(200);
    const categories = detail.json<{ categories: { name: string }[] }>().categories;
    expect(categories.some((category) => category.name === 'Pets')).toBe(true);
  });

  it('assigns categories to recurring outgoings and surfaces them in month view', async () => {
    const user = await register('recurring-cat@example.com', 'Recurring Cat');
    await app.inject({
      method: 'POST',
      url: '/v1/onboarding/complete',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        areas: [{ title: 'Wealth', icon: 'wallet-outline' }],
        preferredCurrency: 'GBP',
      },
    });

    const budgetRes = await app.inject({
      method: 'POST',
      url: '/v1/budgets',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        name: 'Personal budget',
        visibility: 'PRIVATE',
        currency: 'GBP',
        period: 'monthly',
        seedCategories: true,
      },
    });
    expect(budgetRes.statusCode).toBe(201);
    const budget = budgetRes.json<{
      id: string;
      categories: { id: string; name: string }[];
    }>();
    const housing =
      budget.categories.find((category) => category.name === 'Housing') ??
      budget.categories[0];
    expect(housing).toBeTruthy();

    const recurring = await app.inject({
      method: 'POST',
      url: `/v1/budgets/${budget.id}/recurring`,
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        name: 'Rent',
        amountCents: 120_000,
        cadence: 'monthly',
        dayOfMonth: 1,
        categoryId: housing!.id,
      },
    });
    expect(recurring.statusCode).toBe(201);
    expect(recurring.json<{ categoryId: string }>().categoryId).toBe(housing!.id);
    const recurringId = recurring.json<{ id: string }>().id;

    const patched = await app.inject({
      method: 'PATCH',
      url: `/v1/budgets/${budget.id}/recurring/${recurringId}`,
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { categoryId: housing!.id },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json<{ categoryId: string }>().categoryId).toBe(housing!.id);

    const now = new Date();
    const outgoings = await app.inject({
      method: 'GET',
      url: `/v1/budgets/${budget.id}/outgoings?year=${now.getUTCFullYear()}&month=${now.getUTCMonth() + 1}`,
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    expect(outgoings.statusCode).toBe(200);
    const rent = outgoings
      .json<{
        list: {
          recurringId: string | null;
          categoryId: string | null;
          categoryName: string | null;
        }[];
      }>()
      .list.find((item) => item.recurringId === recurringId);
    expect(rent?.categoryId).toBe(housing!.id);
    expect(rent?.categoryName).toBe(housing!.name);
  });

  it('marks a project done and reopens it to active', async () => {
    const user = await register('project-done@example.com', 'Project Done');

    const created = await app.inject({
      method: 'POST',
      url: '/v1/items',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        kind: 'PROJECT',
        title: 'Ship Life OS complete',
        body: { priority: 'HIGH', outcome: 'Users can finish projects' },
      },
    });
    expect(created.statusCode).toBe(201);
    const project = created.json<{ id: string; status: string }>();
    expect(project.status).toBe('ACTIVE');

    const completed = await app.inject({
      method: 'PATCH',
      url: `/v1/items/${project.id}`,
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { status: 'DONE' },
    });
    expect(completed.statusCode).toBe(200);
    expect(completed.json<{ status: string }>().status).toBe('DONE');

    const listed = await app.inject({
      method: 'GET',
      url: '/v1/items?kind=PROJECT',
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    expect(listed.statusCode).toBe(200);
    const listedProjects = listed.json<{ id: string; status: string }[]>();
    expect(
      listedProjects.find((item) => item.id === project.id)?.status,
    ).toBe('DONE');

    const reopened = await app.inject({
      method: 'PATCH',
      url: `/v1/items/${project.id}`,
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { status: 'ACTIVE' },
    });
    expect(reopened.statusCode).toBe(200);
    expect(reopened.json<{ status: string }>().status).toBe('ACTIVE');
  });

  it('sets and clears a project deadline via body.targetDate', async () => {
    const user = await register('project-deadline@example.com', 'Project Deadline');

    const created = await app.inject({
      method: 'POST',
      url: '/v1/items',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        kind: 'PROJECT',
        title: 'Deadline project',
        body: { priority: 'MEDIUM', deadline: '2026-12-15' },
      },
    });
    expect(created.statusCode).toBe(201);
    const project = created.json<{
      id: string;
      body: Record<string, unknown>;
    }>();
    expect(project.body.targetDate).toBe('2026-12-15');
    expect(project.body.deadline).toBeUndefined();

    const patched = await app.inject({
      method: 'PATCH',
      url: `/v1/items/${project.id}`,
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        body: {
          priority: 'MEDIUM',
          outcome: 'Ship with a date',
          targetDate: '2026-12-20',
        },
      },
    });
    expect(patched.statusCode).toBe(200);
    expect(
      patched.json<{ body: { targetDate?: string } }>().body.targetDate,
    ).toBe('2026-12-20');

    const cleared = await app.inject({
      method: 'PATCH',
      url: `/v1/items/${project.id}`,
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        body: {
          priority: 'MEDIUM',
          outcome: 'Ship with a date',
          targetDate: null,
        },
      },
    });
    expect(cleared.statusCode).toBe(200);
    const clearedBody = cleared.json<{ body: Record<string, unknown> }>().body;
    expect(clearedBody.targetDate).toBeUndefined();
    expect(clearedBody.deadline).toBeUndefined();

    const calendar = await app.inject({
      method: 'GET',
      url: '/v1/calendar?view=month&year=2026&month=12&types=milestone',
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    expect(calendar.statusCode).toBe(200);
    expect(
      calendar
        .json<{ events: { id: string }[] }>()
        .events.some((event) => event.id === `milestone:${project.id}`),
    ).toBe(false);

    const withDeadline = await app.inject({
      method: 'PATCH',
      url: `/v1/items/${project.id}`,
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        body: { priority: 'MEDIUM', targetDate: '2026-12-25' },
      },
    });
    expect(withDeadline.statusCode).toBe(200);

    const milestones = await app.inject({
      method: 'GET',
      url: '/v1/calendar?view=month&year=2026&month=12&types=milestone',
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    expect(milestones.statusCode).toBe(200);
    const milestone = milestones
      .json<{
        events: { id: string; type: string; date: string; title: string }[];
        counts: { milestones: number };
      }>()
      .events.find((event) => event.id === `milestone:${project.id}`);
    expect(milestone).toMatchObject({
      type: 'milestone',
      date: '2026-12-25',
    });
    expect(milestone?.title).toContain('Deadline project');
    expect(milestones.json<{ counts: { milestones: number } }>().counts.milestones).toBeGreaterThan(
      0,
    );
  });

  it('projects saving-goal target dates as calendar milestones with deep links', async () => {
    const user = await register('saving-milestone@example.com', 'Saving Milestone');
    const created = await app.inject({
      method: 'POST',
      url: '/v1/saving-goals',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        name: 'Studio deposit',
        category: 'house_deposit',
        targetCents: 450_000,
        currentCents: 125_000,
        targetDate: '2027-02-14',
        visibility: 'PRIVATE',
      },
    });
    expect(created.statusCode).toBe(201);
    const goal = created.json<{ id: string }>();

    const calendar = await app.inject({
      method: 'GET',
      url: '/v1/calendar?view=month&year=2027&month=2&types=milestone',
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    expect(calendar.statusCode).toBe(200);
    const payload = calendar.json<{
      events: {
        id: string;
        type: string;
        date: string;
        title: string;
        amountCents: number | null;
        source: string;
        meta: {
          savingGoalId?: string;
          targetDate?: string;
          deepLink?: { mobile: string; web: string };
        };
      }[];
      counts: { milestones: number };
    }>();
    const milestone = payload.events.find(
      (event) => event.id === `milestone:saving-goal:${goal.id}`,
    );
    expect(milestone).toMatchObject({
      type: 'milestone',
      date: '2027-02-14',
      title: 'Saving target · Studio deposit',
      amountCents: 450_000,
      source: 'saving_goal',
      meta: {
        savingGoalId: goal.id,
        targetDate: '2027-02-14',
      },
    });
    expect(milestone?.meta.deepLink).toEqual({
      mobile: `lifeos://money/wealth/savings/${goal.id}`,
      web: `/?tab=money&money=wealth&savingGoalId=${goal.id}`,
    });
    expect(payload.counts.milestones).toBeGreaterThanOrEqual(1);

    const tasksOnly = await app.inject({
      method: 'GET',
      url: '/v1/calendar?view=month&year=2027&month=2&types=task',
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    expect(
      tasksOnly
        .json<{ events: { source: string }[] }>()
        .events.some((event) => event.source === 'saving_goal'),
    ).toBe(false);
  });

  it('shows dated Schedule actions on Calendar', async () => {
    const user = await register('schedule-calendar@example.com', 'Schedule Calendar');
    const created = await app.inject({
      method: 'POST',
      url: '/v1/items',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        kind: 'ACTION',
        title: 'Prepare quarterly plan',
        body: {
          day: 'This week',
          importance: 'HIGH',
          urgency: 'LOW',
          scheduledDate: '2027-01-14',
        },
      },
    });
    expect(created.statusCode).toBe(201);
    const action = created.json<{ id: string }>();

    const calendar = await app.inject({
      method: 'GET',
      url: '/v1/calendar?view=month&year=2027&month=1&types=task',
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    expect(calendar.statusCode).toBe(200);
    const event = calendar
      .json<{
        events: { id: string; type: string; date: string; title: string }[];
      }>()
      .events.find((candidate) => candidate.id === `task:${action.id}`);
    expect(event).toMatchObject({
      type: 'task',
      date: '2027-01-14',
      title: 'Prepare quarterly plan',
    });
  });

  it('persists primary move on profile while calendar tasks stay scheduled', async () => {
    const user = await register('primary-move@example.com', 'Primary Move');
    const action = await app.inject({
      method: 'POST',
      url: '/v1/items',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: {
        kind: 'ACTION',
        title: 'Ship integration branch',
        body: {
          day: 'Today',
          importance: 'HIGH',
          urgency: 'HIGH',
          scheduledDate: '2027-03-01',
        },
      },
    });
    expect(action.statusCode).toBe(201);
    const actionId = action.json<{ id: string }>().id;

    const profile = await app.inject({
      method: 'PATCH',
      url: '/v1/me',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { body: { primaryMoveActionId: actionId } },
    });
    expect(profile.statusCode).toBe(200);
    expect(
      profile.json<{ user: { body: { primaryMoveActionId: string } } }>().user
        .body.primaryMoveActionId,
    ).toBe(actionId);

    const calendar = await app.inject({
      method: 'GET',
      url: '/v1/calendar?view=month&year=2027&month=3&types=task',
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    expect(calendar.statusCode).toBe(200);
    expect(
      calendar
        .json<{ events: { id: string; date: string }[] }>()
        .events.some(
          (event) => event.id === `task:${actionId}` && event.date === '2027-03-01',
        ),
    ).toBe(true);
  });
});
