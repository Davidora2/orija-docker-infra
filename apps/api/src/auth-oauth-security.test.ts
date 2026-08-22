import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from './config.js';
import { createDatabase, type Database } from './db.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;

vi.mock('./google-auth.js', () => ({
  verifyGoogleIdToken: vi.fn(),
}));

vi.mock('./microsoft-auth.js', () => ({
  verifyMicrosoftIdToken: vi.fn(),
}));

suite('OAuth email account takeover prevention', () => {
  let sql: Database;
  let app: Awaited<ReturnType<typeof import('./app.js').buildApp>>;
  let verifyGoogleIdToken: ReturnType<typeof vi.fn>;
  let verifyMicrosoftIdToken: ReturnType<typeof vi.fn>;

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
    authEmailVerificationDisabled: false,
    skipEmailSend: false,
    allowTestRegistrationEmails: true,
  };

  beforeAll(async () => {
    const googleAuth = await import('./google-auth.js');
    const microsoftAuth = await import('./microsoft-auth.js');
    verifyGoogleIdToken = googleAuth.verifyGoogleIdToken as unknown as ReturnType<typeof vi.fn>;
    verifyMicrosoftIdToken =
      microsoftAuth.verifyMicrosoftIdToken as unknown as ReturnType<typeof vi.fn>;

    const { buildApp } = await import('./app.js');
    sql = createDatabase(databaseUrl!);
    app = await buildApp(config, {
      sql,
      logger: false,
      runSchemaMigrations: true,
    });
  });

  beforeEach(async () => {
    verifyGoogleIdToken.mockReset();
    verifyMicrosoftIdToken.mockReset();
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

  async function registerUnverified(email: string, displayName: string) {
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
    return response.json<{
      requiresEmailVerification: boolean;
      debugCode: string;
      email: string;
    }>();
  }

  async function registerVerified(email: string, displayName: string) {
    const registered = await registerUnverified(email, displayName);
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
    return verify.json<{
      accessToken: string;
      account: { user: { id: string; email: string } };
    }>();
  }

  it('blocks password login until email is verified', async () => {
    await registerUnverified('unverified@example.com', 'Unverified');

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        email: 'unverified@example.com',
        password: 'correct-horse-battery-staple',
      },
    });
    expect(login.statusCode).toBe(403);
    expect(login.json()).toMatchObject({ error: 'email_not_verified' });
  });

  it('does not hand Google session to attacker who pre-registered victim email', async () => {
    const attacker = await registerUnverified('victim@example.com', 'Attacker');
    expect(attacker.requiresEmailVerification).toBe(true);

    const [attackerRow] = await sql<{ id: string }[]>`
      SELECT id FROM users WHERE email = 'victim@example.com'
    `;
    expect(attackerRow).toBeTruthy();

    verifyGoogleIdToken.mockResolvedValue({
      sub: 'google-victim-sub-1',
      email: 'victim@example.com',
      emailVerified: true,
      name: 'Real Victim',
      picture: null,
    });

    const google = await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: {
        idToken: 'x'.repeat(40),
        deviceName: 'vitest',
        timezone: 'UTC',
      },
    });

    expect(google.statusCode).toBe(409);
    expect(google.json()).toMatchObject({ error: 'account_exists_link_required' });
    expect(google.json()).not.toHaveProperty('accessToken');

    const users = await sql<{ id: string; googleSub: string | null }[]>`
      SELECT id, google_sub FROM users WHERE email = 'victim@example.com'
    `;
    expect(users).toHaveLength(1);
    expect(users[0]?.id).toBe(attackerRow!.id);
    expect(users[0]?.googleSub).toBeNull();
  });

  it('does not hand Microsoft session to attacker who pre-registered victim email', async () => {
    await registerUnverified('ms-victim@example.com', 'Attacker');

    const [attackerRow] = await sql<{ id: string }[]>`
      SELECT id FROM users WHERE email = 'ms-victim@example.com'
    `;

    verifyMicrosoftIdToken.mockResolvedValue({
      sub: 'ms-victim-sub-1',
      email: 'ms-victim@example.com',
      emailVerified: true,
      name: 'Real Victim',
      picture: null,
    });

    const microsoft = await app.inject({
      method: 'POST',
      url: '/v1/auth/microsoft',
      payload: {
        idToken: 'y'.repeat(40),
        deviceName: 'vitest',
        timezone: 'UTC',
      },
    });

    expect(microsoft.statusCode).toBe(409);
    expect(microsoft.json()).toMatchObject({ error: 'account_exists_link_required' });
    expect(microsoft.json()).not.toHaveProperty('accessToken');

    const [row] = await sql<{ id: string; microsoftSub: string | null }[]>`
      SELECT id, microsoft_sub FROM users WHERE email = 'ms-victim@example.com'
    `;
    expect(row?.id).toBe(attackerRow!.id);
    expect(row?.microsoftSub).toBeNull();
  });

  it('creates a new Google user when email is free and IdP email is verified', async () => {
    verifyGoogleIdToken.mockResolvedValue({
      sub: 'google-new-sub',
      email: 'new-google@example.com',
      emailVerified: true,
      name: 'New Google',
      picture: 'https://example.com/a.png',
    });

    const google = await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: {
        idToken: 'z'.repeat(40),
        deviceName: 'vitest',
      },
    });
    expect(google.statusCode).toBe(200);
    const body = google.json<{
      accessToken: string;
      account: { user: { id: string; email: string } };
    }>();
    expect(body.accessToken).toBeTruthy();
    expect(body.account.user.email).toBe('new-google@example.com');

    const [row] = await sql<{ googleSub: string | null; emailVerifiedAt: Date | null }[]>`
      SELECT google_sub, email_verified_at FROM users WHERE email = 'new-google@example.com'
    `;
    expect(row?.googleSub).toBe('google-new-sub');
    expect(row?.emailVerifiedAt).toBeTruthy();
  });

  it('rejects Google sign-in when IdP email is unverified', async () => {
    verifyGoogleIdToken.mockResolvedValue({
      sub: 'google-unverified-sub',
      email: 'unverified-idp@example.com',
      emailVerified: false,
      name: 'Nope',
      picture: null,
    });

    const google = await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: { idToken: 'a'.repeat(40) },
    });
    expect(google.statusCode).toBe(403);
    expect(google.json()).toMatchObject({ error: 'idp_email_unverified' });
  });

  it('allows verified password user to explicitly link Google', async () => {
    const session = await registerVerified('link-me@example.com', 'Linker');

    verifyGoogleIdToken.mockResolvedValue({
      sub: 'google-link-sub',
      email: 'link-me@example.com',
      emailVerified: true,
      name: 'Linker',
      picture: null,
    });

    // Still blocked from silent merge via /google
    const blocked = await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: { idToken: 'b'.repeat(40) },
    });
    expect(blocked.statusCode).toBe(409);

    const linked = await app.inject({
      method: 'POST',
      url: '/v1/auth/link/google',
      headers: { authorization: `Bearer ${session.accessToken}` },
      payload: { idToken: 'b'.repeat(40) },
    });
    expect(linked.statusCode).toBe(200);
    expect(linked.json()).toMatchObject({ ok: true, linked: 'google' });

    // Subsequent Google sign-in uses sub match and returns same user
    const signedIn = await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: { idToken: 'b'.repeat(40) },
    });
    expect(signedIn.statusCode).toBe(200);
    const signedBody = signedIn.json<{
      account: { user: { id: string } };
    }>();
    expect(signedBody.account.user.id).toBe(session.account.user.id);
  });

  it('allows verified password user to explicitly link Microsoft', async () => {
    const session = await registerVerified('ms-link@example.com', 'Ms Linker');

    verifyMicrosoftIdToken.mockResolvedValue({
      sub: 'ms-link-sub',
      email: 'ms-link@example.com',
      emailVerified: true,
      name: 'Ms Linker',
      picture: null,
    });

    const linked = await app.inject({
      method: 'POST',
      url: '/v1/auth/link/microsoft',
      headers: { authorization: `Bearer ${session.accessToken}` },
      payload: { idToken: 'c'.repeat(40) },
    });
    expect(linked.statusCode).toBe(200);
    expect(linked.json()).toMatchObject({ ok: true, linked: 'microsoft' });
  });

  it('rejects linking when social email does not match account email', async () => {
    const session = await registerVerified('mine@example.com', 'Mine');

    verifyGoogleIdToken.mockResolvedValue({
      sub: 'google-other-sub',
      email: 'other@example.com',
      emailVerified: true,
      name: 'Other',
      picture: null,
    });

    const linked = await app.inject({
      method: 'POST',
      url: '/v1/auth/link/google',
      headers: { authorization: `Bearer ${session.accessToken}` },
      payload: { idToken: 'd'.repeat(40) },
    });
    expect(linked.statusCode).toBe(400);
    expect(linked.json()).toMatchObject({ error: 'email_mismatch' });
  });
});
