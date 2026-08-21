/**
 * Regression: expo-auth-session Google provider throws when client id is
 * undefined. AccountSheet must not call the hook unless a client id is set.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));

const providerUtilsPath = require.resolve('expo-auth-session/build/providers/ProviderUtils.js');
const { invariantClientId } = require(providerUtilsPath);

assert.throws(
  () => invariantClientId('androidClientId', undefined, 'Google'),
  /androidClientId.*must be defined/,
);
assert.doesNotThrow(() =>
  invariantClientId(
    'androidClientId',
    '717142192703-example.apps.googleusercontent.com',
    'Google',
  ),
);

const sheet = readFileSync(join(root, 'src/account-sheet.tsx'), 'utf8');
assert.match(sheet, /function GoogleSignInButton/);
assert.match(
  sheet,
  /googleClientId &&[\s\S]*<GoogleSignInButton/,
  'GoogleSignInButton must only render when googleClientId is set',
);
assert.doesNotMatch(
  sheet,
  /Google\.useIdTokenAuthRequest\(\{[\s\S]*googleClientId \|\| undefined/,
  'AccountSheet must not call useIdTokenAuthRequest with undefined client ids',
);

console.log(
  JSON.stringify(
    {
      invariantThrowsWithoutClientId: true,
      googleHookGuardedByClientId: true,
    },
    null,
    2,
  ),
);
