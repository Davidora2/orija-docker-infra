import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import type { AppConfig } from './config.js';
import { createDatabase, type Database } from './db.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;

suite('weekly review and account privacy API', () => {
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
      enableBillReminders: false,
    });
  });

  beforeEach(async () => {
    await sql`
      TRUNCATE TABLE
        account_deletion_audit,
        weekly_reviews,
        auth_codes,
        calendar_sync_links,
        calendar_oauth_states,
        calendar_connections,
        budget_entries,
        budget_recurring_outgoings,
        budget_draft_expenses,
        budget_categories,
        budgets,
        wealth_gap_ideas,
        investment_accounts,
        saving_goals,
        debts,
        payment_occurrences,
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
    const created = await app.inject({
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
    expect(created.statusCode).toBe(201);
    const pending = created.json<{ debugCode: string }>();
    const verified = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-email',
      payload: { email, code: pending.debugCode, deviceName: 'vitest' },
    });
    expect(verified.statusCode).toBe(200);
    return verified.json<{
      accessToken: string;
      account: {
        user: { id: string; email: string };
        activeHouseholdId: string;
      };
    }>();
  }

  function reviewPayload(householdId?: string) {
    return {
      schemaVersion: 1,
      householdId,
      weekStart: '2026-08-17',
      results: {
        completedActions: 4,
        totalActions: 6,
        completionRate: 67,
        highlights: 'Shipped the priority project.',
      },
      capacity: { plannedHours: 12, availableHours: 10 },
      bottlenecks: 'Too many handoffs.',
      startDoing: 'Block focus time.',
      stopDoing: 'Accepting unplanned work.',
      continueDoing: 'Daily priority check.',
      nextWeekPriorities: ['Finish onboarding', 'Review budget'],
    };
  }

  it('persists review history and blocks cross-user and cross-household access', async () => {
    const owner = await register('review-owner@example.com', 'Review Owner');
    const outsider = await register('review-outsider@example.com', 'Outsider');

    const created = await app.inject({
      method: 'POST',
      url: '/v1/weekly-reviews',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: reviewPayload(),
    });
    expect(created.statusCode).toBe(201);
    const review = created.json<{ id: string; schemaVersion: number }>();
    expect(review.schemaVersion).toBe(1);

    const history = await app.inject({
      method: 'GET',
      url: '/v1/weekly-reviews',
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(history.statusCode).toBe(200);
    expect(history.json()).toMatchObject([
      {
        id: review.id,
        userId: owner.account.user.id,
        householdId: owner.account.activeHouseholdId,
        bottlenecks: 'Too many handoffs.',
      },
    ]);

    const otherUserRead = await app.inject({
      method: 'GET',
      url: `/v1/weekly-reviews/${review.id}`,
      headers: { authorization: `Bearer ${outsider.accessToken}` },
    });
    expect(otherUserRead.statusCode).toBe(404);

    const otherHouseholdList = await app.inject({
      method: 'GET',
      url: `/v1/weekly-reviews?householdId=${owner.account.activeHouseholdId}`,
      headers: { authorization: `Bearer ${outsider.accessToken}` },
    });
    expect(otherHouseholdList.statusCode).toBe(403);
  });

  it('exports only the requesting user data and never exports OAuth secrets', async () => {
    const owner = await register('export-owner@example.com', 'Export Owner');
    const outsider = await register('export-outsider@example.com', 'Export Outsider');

    await app.inject({
      method: 'POST',
      url: '/v1/items',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { kind: 'IDEA', title: 'My export item', visibility: 'PRIVATE' },
    });
    await app.inject({
      method: 'POST',
      url: '/v1/items',
      headers: { authorization: `Bearer ${outsider.accessToken}` },
      payload: { kind: 'IDEA', title: 'Outsider secret', visibility: 'PRIVATE' },
    });
    await app.inject({
      method: 'POST',
      url: '/v1/weekly-reviews',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: reviewPayload(),
    });
    await sql`
      INSERT INTO calendar_connections (
        user_id, provider, account_email, access_token_enc, refresh_token_enc
      ) VALUES (
        ${owner.account.user.id},
        'google',
        'export-owner@example.com',
        'never-export-access-secret',
        'never-export-refresh-secret'
      )
    `;

    const response = await app.inject({
      method: 'GET',
      url: '/v1/me/export',
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-disposition']).toContain('life-os-export.json');
    const raw = response.body;
    expect(raw).toContain('My export item');
    expect(raw).toContain('Shipped the priority project.');
    expect(raw).not.toContain('Outsider secret');
    expect(raw).not.toContain('export-outsider@example.com');
    expect(raw).not.toContain('never-export-access-secret');
    expect(raw).not.toContain('never-export-refresh-secret');
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toContain('googleSub');
  });

  it('requires typed confirmation and password reauthentication before safe deletion', async () => {
    const owner = await register('delete-owner@example.com', 'Delete Owner');
    const partner = await register('delete-partner@example.com', 'Delete Partner');
    const inviteResponse = await app.inject({
      method: 'POST',
      url: '/v1/households/invites',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { invitedEmail: partner.account.user.email },
    });
    const invite = inviteResponse.json<{ token: string }>();
    await app.inject({
      method: 'POST',
      url: '/v1/households/invites/accept',
      headers: { authorization: `Bearer ${partner.accessToken}` },
      payload: { token: invite.token },
    });

    const mismatch = await app.inject({
      method: 'DELETE',
      url: '/v1/me',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        confirmation: 'DELETE account',
        currentPassword: 'correct-horse-battery-staple',
      },
    });
    expect(mismatch.statusCode).toBe(400);
    expect(mismatch.json()).toMatchObject({ error: 'delete_confirmation_mismatch' });

    const wrongPassword = await app.inject({
      method: 'DELETE',
      url: '/v1/me',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        confirmation: 'DELETE delete-owner@example.com',
        currentPassword: 'wrong-password',
      },
    });
    expect(wrongPassword.statusCode).toBe(401);

    const deleted = await app.inject({
      method: 'DELETE',
      url: '/v1/me',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        confirmation: 'DELETE delete-owner@example.com',
        currentPassword: 'correct-horse-battery-staple',
      },
    });
    expect(deleted.statusCode).toBe(204);

    const [ownerRow] = await sql<{ id: string }[]>`
      SELECT id FROM users WHERE id = ${owner.account.user.id}
    `;
    expect(ownerRow).toBeUndefined();
    const [survivingHousehold] = await sql<{ createdBy: string; role: string }[]>`
      SELECT h.created_by, hm.role
      FROM households h
      JOIN household_members hm
        ON hm.household_id = h.id
        AND hm.user_id = ${partner.account.user.id}
      WHERE h.id = ${owner.account.activeHouseholdId}
    `;
    expect(survivingHousehold).toMatchObject({
      createdBy: partner.account.user.id,
      role: 'OWNER',
    });
    const [audit] = await sql<{ emailSha256: string }[]>`
      SELECT email_sha256
      FROM account_deletion_audit
      WHERE deleted_user_id = ${owner.account.user.id}
    `;
    expect(audit?.emailSha256).toHaveLength(64);
    expect(audit?.emailSha256).not.toContain('delete-owner@example.com');
  });

  it('only exposes the real email reminder delivery preference', async () => {
    const user = await register('preferences@example.com', 'Preferences');
    const updated = await app.inject({
      method: 'PATCH',
      url: '/v1/me/preferences',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { emailRemindersEnabled: false },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toEqual({
      emailRemindersEnabled: false,
      deliveryChannels: ['email'],
    });

    const manualReminder = await app.inject({
      method: 'POST',
      url: '/v1/payments/reminders/run',
      headers: { authorization: `Bearer ${user.accessToken}` },
    });
    expect(manualReminder.statusCode).toBe(200);
    expect(manualReminder.json()).toMatchObject({ sent: false, optedOut: true });
  });
});
