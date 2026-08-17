import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ApiError } from './errors.js';

export type MicrosoftIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function microsoftJwks(tenant: string) {
  const key = tenant || 'common';
  let jwks = jwksCache.get(key);
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(
        `https://login.microsoftonline.com/${key}/discovery/v2.0/keys`,
      ),
    );
    jwksCache.set(key, jwks);
  }
  return jwks;
}

export async function verifyMicrosoftIdToken(
  idToken: string,
  clientIds: string[],
  tenant = 'common',
): Promise<MicrosoftIdentity> {
  if (clientIds.length === 0) {
    throw new ApiError(
      503,
      'microsoft_auth_unconfigured',
      'Microsoft sign-in is not configured on this server.',
    );
  }

  try {
    const { payload } = await jwtVerify(idToken, microsoftJwks(tenant), {
      audience: clientIds,
    });

    const issuer = String(payload.iss ?? '');
    const allowedIssuer =
      issuer.startsWith('https://login.microsoftonline.com/') &&
      issuer.endsWith('/v2.0');
    if (!allowedIssuer) {
      throw new ApiError(401, 'invalid_microsoft_token', 'Unexpected Microsoft issuer.');
    }

    const email = String(
      payload.email ?? payload.preferred_username ?? '',
    )
      .trim()
      .toLowerCase();
    const sub = String(payload.sub ?? '');
    if (!email || !sub) {
      throw new ApiError(
        401,
        'invalid_microsoft_token',
        'Microsoft token is missing identity.',
      );
    }

    return {
      sub,
      email,
      emailVerified: Boolean(payload.email_verified ?? true),
      name: typeof payload.name === 'string' ? payload.name : null,
      picture: null,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      401,
      'invalid_microsoft_token',
      'Microsoft sign-in token is invalid.',
    );
  }
}
