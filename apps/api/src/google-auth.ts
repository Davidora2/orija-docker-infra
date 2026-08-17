import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ApiError } from './errors.js';

const googleJwks = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
);

export type GoogleIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

export async function verifyGoogleIdToken(
  idToken: string,
  clientIds: string[],
): Promise<GoogleIdentity> {
  if (clientIds.length === 0) {
    throw new ApiError(
      503,
      'google_auth_unconfigured',
      'Google sign-in is not configured on this server.',
    );
  }

  try {
    const { payload } = await jwtVerify(idToken, googleJwks, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientIds,
    });

    const email = String(payload.email ?? '')
      .trim()
      .toLowerCase();
    const sub = String(payload.sub ?? '');
    if (!email || !sub) {
      throw new ApiError(401, 'invalid_google_token', 'Google token is missing identity.');
    }

    return {
      sub,
      email,
      emailVerified: Boolean(payload.email_verified),
      name: typeof payload.name === 'string' ? payload.name : null,
      picture: typeof payload.picture === 'string' ? payload.picture : null,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, 'invalid_google_token', 'Google sign-in token is invalid.');
  }
}
