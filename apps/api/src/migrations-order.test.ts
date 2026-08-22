import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('schema migrations 014–016', () => {
  it('registers onboarding, profile body, and weekly review migrations in order', async () => {
    const source = readFileSync(
      fileURLToPath(new URL('./migrations.ts', import.meta.url)),
      'utf8',
    );
    const versions = [...source.matchAll(/version: '([^']+)'/g)].map(
      (match) => match[1],
    );
    const tail = versions.slice(versions.indexOf('013_email_verification_oauth_link'));
    expect(tail).toEqual([
      '013_email_verification_oauth_link',
      '014_onboarding_progress',
      '015_user_profile_body',
      '016_weekly_reviews_privacy',
    ]);
  });

  it('includes SQL files for migrations 014–016', () => {
    for (const version of [
      '014_onboarding_progress',
      '015_user_profile_body',
      '016_weekly_reviews_privacy',
    ]) {
      const path = fileURLToPath(
        new URL(`../migrations/${version}.sql`, import.meta.url),
      );
      expect(readFileSync(path, 'utf8').length).toBeGreaterThan(10);
    }
  });
});
