import { resolveMx } from 'node:dns/promises';
import type { AppConfig } from './config.js';
import { ApiError } from './errors.js';

/** Domains that must never receive Life OS auth/transactional mail. */
export const BLOCKED_EMAIL_DOMAINS = [
  'example.com',
  'example.org',
  'example.net',
  'orija.store',
  'lifeos-audit.local',
  'localhost',
  'invalid',
  'test',
] as const;

/** Local-part prefixes used by cloud agents and automated tests. */
export const BLOCKED_LOCAL_PART_PATTERNS: RegExp[] = [
  /^audit-ui-/i,
  /^dark-heroes-/i,
  /^audit-\d+/i,
  /^test-/i,
  /^cursor-/i,
  /^agent-/i,
  /^life-os-/i,
];

export type EmailDeliveryPurpose = 'auth' | 'transactional';

export type EmailDeliveryBlockReason =
  | 'skip_env'
  | 'blocked_domain'
  | 'blocked_local_part'
  | 'no_mx';

export function parseEmailAddress(email: string): { local: string; domain: string } | null {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at <= 0 || at === normalized.length - 1) return null;
  return { local: normalized.slice(0, at), domain: normalized.slice(at + 1) };
}

export function isBlockedEmailDomain(domain: string, config: AppConfig): boolean {
  const normalized = domain.toLowerCase();
  if (
    config.allowTestRegistrationEmails &&
    (normalized === 'example.com' || normalized.endsWith('.example.com'))
  ) {
    return false;
  }
  return BLOCKED_EMAIL_DOMAINS.some(
    (blocked) => normalized === blocked || normalized.endsWith(`.${blocked}`),
  );
}

export function isBlockedLocalPart(local: string): boolean {
  return BLOCKED_LOCAL_PART_PATTERNS.some((pattern) => pattern.test(local));
}

export function getRegistrationEmailBlockReason(
  email: string,
  config: AppConfig,
): 'invalid_email' | 'blocked_domain' | 'blocked_local_part' | null {
  const parsed = parseEmailAddress(email);
  if (!parsed) return 'invalid_email';
  if (isBlockedEmailDomain(parsed.domain, config)) return 'blocked_domain';
  if (isBlockedLocalPart(parsed.local)) return 'blocked_local_part';
  return null;
}

export function assertRegistrationEmailAllowed(email: string, config: AppConfig): void {
  const reason = getRegistrationEmailBlockReason(email, config);
  if (!reason) return;

  throw new ApiError(
    400,
    'registration_email_blocked',
    'That email address cannot be used for registration. Use a real personal email address.',
  );
}

const mxCache = new Map<string, { ok: boolean; checkedAt: number }>();
const MX_CACHE_TTL_MS = 60 * 60 * 1000;

export async function domainHasMxRecords(domain: string): Promise<boolean> {
  const key = domain.toLowerCase();
  const cached = mxCache.get(key);
  if (cached && Date.now() - cached.checkedAt < MX_CACHE_TTL_MS) {
    return cached.ok;
  }

  try {
    const records = await resolveMx(key);
    const ok = records.length > 0;
    mxCache.set(key, { ok, checkedAt: Date.now() });
    return ok;
  } catch {
    mxCache.set(key, { ok: false, checkedAt: Date.now() });
    return false;
  }
}

export async function getEmailDeliveryBlockReason(
  email: string,
  config: AppConfig,
  purpose: EmailDeliveryPurpose = 'auth',
): Promise<EmailDeliveryBlockReason | null> {
  if (config.skipEmailSend) return 'skip_env';
  if (purpose === 'auth' && config.authEmailVerificationDisabled) return 'skip_env';

  const parsed = parseEmailAddress(email);
  if (!parsed) return 'blocked_domain';
  if (isBlockedEmailDomain(parsed.domain, config)) return 'blocked_domain';
  if (isBlockedLocalPart(parsed.local)) return 'blocked_local_part';

  if (config.nodeEnv === 'test') return null;

  const hasMx = await domainHasMxRecords(parsed.domain);
  if (!hasMx) return 'no_mx';
  return null;
}

export function clearEmailGuardCachesForTests(): void {
  mxCache.clear();
}
