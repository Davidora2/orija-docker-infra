import type { FastifyReply, FastifyRequest } from 'fastify';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { AppConfig } from './config.js';
import type { Database } from './db.js';
import { createOpaqueToken, hashToken } from './security.js';

export type AuthUser = {
  id: string;
  email: string;
};

declare module 'fastify' {
  interface FastifyRequest {
    authUser: AuthUser;
  }
}

type AccessPayload = JWTPayload & {
  email: string;
  type: 'access';
};

export function createAuth(config: AppConfig, sql: Database) {
  const key = new TextEncoder().encode(config.jwtSecret);

  async function signAccessToken(user: AuthUser): Promise<string> {
    return new SignJWT({ email: user.email, type: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(config.accessTokenTtl)
      .setIssuer('life-os-api')
      .setAudience('life-os-clients')
      .sign(key);
  }

  async function verifyAccessToken(token: string): Promise<AuthUser> {
    const { payload } = await jwtVerify<AccessPayload>(token, key, {
      issuer: 'life-os-api',
      audience: 'life-os-clients',
    });
    if (!payload.sub || payload.type !== 'access' || !payload.email) {
      throw new Error('Invalid access token');
    }
    return { id: payload.sub, email: payload.email };
  }

  async function issueSession(
    user: AuthUser,
    deviceName?: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: string }> {
    const refreshToken = createOpaqueToken();
    const refreshHash = hashToken(refreshToken);
    const expiresAt = new Date(
      Date.now() + config.refreshTokenDays * 24 * 60 * 60 * 1000,
    );

    await sql`
      INSERT INTO refresh_tokens (
        user_id, token_hash, device_name, expires_at
      ) VALUES (
        ${user.id}, ${refreshHash}, ${deviceName ?? null}, ${expiresAt}
      )
    `;

    return {
      accessToken: await signAccessToken(user),
      refreshToken,
      expiresIn: config.accessTokenTtl,
    };
  }

  async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      return reply.code(401).send({
        error: 'unauthorized',
        message: 'A valid access token is required.',
      });
    }

    try {
      request.authUser = await verifyAccessToken(authorization.slice(7));
    } catch {
      return reply.code(401).send({
        error: 'unauthorized',
        message: 'The access token is invalid or expired.',
      });
    }
  }

  return {
    authenticate,
    issueSession,
    signAccessToken,
    verifyAccessToken,
  };
}

export type AuthService = ReturnType<typeof createAuth>;
