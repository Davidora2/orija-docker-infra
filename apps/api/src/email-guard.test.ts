import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from './config.js';
import {
  assertRegistrationEmailAllowed,
  clearEmailGuardCachesForTests,
  getEmailDeliveryBlockReason,
  getRegistrationEmailBlockReason,
  isBlockedEmailDomain,
  isBlockedLocalPart,
} from './email-guard.js';
import { ApiError } from './errors.js';

const productionConfig: AppConfig = {
  nodeEnv: 'production',
  host: '0.0.0.0',
  port: 4000,
  databaseUrl: 'postgres://example',
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
  emailFrom: 'Life OS <noreply@example.com>',
  smtpUser: 'smtp-user',
  smtpAppPassword: 'smtp-pass',
  smtpHost: 'smtp.gmail.com',
  smtpPort: 465,
  authDebugCodes: false,
  authEmailVerificationDisabled: false,
  skipEmailSend: false,
  allowTestRegistrationEmails: false,
};

const testConfig: AppConfig = {
  ...productionConfig,
  nodeEnv: 'test',
  allowTestRegistrationEmails: true,
};

afterEach(() => {
  clearEmailGuardCachesForTests();
  vi.restoreAllMocks();
});

describe('registration email blocklist', () => {
  it('blocks example.com in production', () => {
    expect(getRegistrationEmailBlockReason('audit-ui-1@example.com', productionConfig)).toBe(
      'blocked_domain',
    );
    expect(() =>
      assertRegistrationEmailAllowed('audit-ui-1@example.com', productionConfig),
    ).toThrow(ApiError);
  });

  it('allows example.com in test environment', () => {
    expect(getRegistrationEmailBlockReason('owner@example.com', testConfig)).toBeNull();
    expect(() => assertRegistrationEmailAllowed('owner@example.com', testConfig)).not.toThrow();
  });

  it('blocks orija.store agent addresses', () => {
    expect(
      getRegistrationEmailBlockReason('dark-heroes-1787436678@orija.store', productionConfig),
    ).toBe('blocked_domain');
    expect(isBlockedEmailDomain('orija.store', productionConfig)).toBe(true);
    expect(isBlockedEmailDomain('agents.orija.store', productionConfig)).toBe(true);
  });

  it('blocks obvious agent local-part prefixes', () => {
    expect(isBlockedLocalPart('audit-ui-123')).toBe(true);
    expect(isBlockedLocalPart('dark-heroes-999')).toBe(true);
    expect(isBlockedLocalPart('test-runner')).toBe(true);
    expect(isBlockedLocalPart('cursor-agent')).toBe(true);
    expect(isBlockedLocalPart('jane.doe')).toBe(false);
  });

  it('blocks agent prefixes even on real-looking domains', () => {
    expect(
      getRegistrationEmailBlockReason('dark-heroes-1@gmail.com', productionConfig),
    ).toBe('blocked_local_part');
  });

  it('returns ApiError with registration_email_blocked code', () => {
    try {
      assertRegistrationEmailAllowed('dark-heroes-1@orija.store', productionConfig);
      throw new Error('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(400);
      expect((error as ApiError).code).toBe('registration_email_blocked');
    }
  });
});

describe('email delivery guard', () => {
  it('skips auth mail when AUTH_EMAIL_VERIFICATION_DISABLED is set', async () => {
    const config = { ...productionConfig, authEmailVerificationDisabled: true };
    await expect(
      getEmailDeliveryBlockReason('user@gmail.com', config, 'auth'),
    ).resolves.toBe('skip_env');
    await expect(
      getEmailDeliveryBlockReason('user@gmail.com', config, 'transactional'),
    ).resolves.toBeNull();
  });

  it('skips all mail when SKIP_EMAIL_SEND is set', async () => {
    const config = { ...productionConfig, skipEmailSend: true };
    await expect(
      getEmailDeliveryBlockReason('user@gmail.com', config, 'transactional'),
    ).resolves.toBe('skip_env');
  });

  it('blocks fake domains before SMTP', async () => {
    await expect(
      getEmailDeliveryBlockReason('dark-heroes-1@orija.store', productionConfig, 'auth'),
    ).resolves.toBe('blocked_domain');
  });

  it('skips MX lookup in test environment', async () => {
    await expect(
      getEmailDeliveryBlockReason('owner@example.com', testConfig, 'auth'),
    ).resolves.toBeNull();
  });
});
