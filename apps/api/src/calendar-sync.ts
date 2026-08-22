import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from './config.js';
import type { Database } from './db.js';
import { ApiError } from './errors.js';
import { loadCalendarEvents, type CalendarEvent } from './calendar.js';
import { decryptSecret, encryptSecret } from './token-crypto.js';

type Provider = 'google' | 'microsoft';

type ConnectionRow = {
  id: string;
  userId: string;
  provider: Provider;
  accountEmail: string | null;
  accessTokenEnc: string;
  refreshTokenEnc: string | null;
  tokenExpiresAt: Date | null;
  scope: string | null;
  calendarId: string;
  syncTasks: boolean;
  syncPayments: boolean;
  syncPaydays: boolean;
  reminderMinutes: number;
  lastSyncedAt: Date | null;
};

function tokenSecret(config: AppConfig): string {
  return config.calendarTokenEncryptionKey || config.jwtSecret;
}

function base64Url(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function pkcePair() {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function googleConfigured(config: AppConfig): boolean {
  return Boolean(config.googleClientIds[0] && config.googleOauthClientSecret);
}

function microsoftConfigured(config: AppConfig): boolean {
  return Boolean(config.microsoftClientId);
}

function callbackUrl(config: AppConfig, provider: Provider): string {
  // PUBLIC_APP_URL is the web origin; API is typically served under /api
  return `${config.publicAppUrl}/api/v1/calendar/oauth/${provider}/callback`;
}

function eventDescription(event: CalendarEvent): string {
  const bits = [`Life OS · ${event.type}`];
  if (event.areaTitle) bits.push(`Area: ${event.areaTitle}`);
  if (event.amountCents != null) {
    bits.push(`Amount: ${(event.amountCents / 100).toFixed(2)}`);
  }
  bits.push('Synced from Life OS');
  return bits.join('\n');
}

async function exchangeGoogleCode(
  config: AppConfig,
  code: string,
  codeVerifier: string | null,
) {
  const clientId = config.googleClientIds[0]!;
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: config.googleOauthClientSecret!,
    redirect_uri: callbackUrl(config, 'google'),
    grant_type: 'authorization_code',
  });
  if (codeVerifier) body.set('code_verifier', codeVerifier);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    throw new ApiError(502, 'google_token_exchange_failed', 'Could not connect Google Calendar.');
  }
  return response.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    id_token?: string;
  }>;
}

async function refreshGoogleAccess(config: AppConfig, refreshToken: string) {
  const body = new URLSearchParams({
    client_id: config.googleClientIds[0]!,
    client_secret: config.googleOauthClientSecret!,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    throw new ApiError(401, 'google_token_refresh_failed', 'Google Calendar access expired. Reconnect.');
  }
  return response.json() as Promise<{
    access_token: string;
    expires_in?: number;
    scope?: string;
  }>;
}

async function exchangeMicrosoftCode(
  config: AppConfig,
  code: string,
  codeVerifier: string | null,
) {
  const tenant = config.microsoftTenantId || 'common';
  const body = new URLSearchParams({
    code,
    client_id: config.microsoftClientId!,
    redirect_uri: callbackUrl(config, 'microsoft'),
    grant_type: 'authorization_code',
    scope:
      'openid profile email offline_access Calendars.ReadWrite',
  });
  if (config.microsoftClientSecret) {
    body.set('client_secret', config.microsoftClientSecret);
  }
  if (codeVerifier) body.set('code_verifier', codeVerifier);

  const response = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    },
  );
  if (!response.ok) {
    throw new ApiError(
      502,
      'microsoft_token_exchange_failed',
      'Could not connect Microsoft calendar.',
    );
  }
  return response.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    id_token?: string;
  }>;
}

async function refreshMicrosoftAccess(config: AppConfig, refreshToken: string) {
  const tenant = config.microsoftTenantId || 'common';
  const body = new URLSearchParams({
    client_id: config.microsoftClientId!,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: 'openid profile email offline_access Calendars.ReadWrite',
  });
  if (config.microsoftClientSecret) {
    body.set('client_secret', config.microsoftClientSecret);
  }
  const response = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    },
  );
  if (!response.ok) {
    throw new ApiError(
      401,
      'microsoft_token_refresh_failed',
      'Microsoft calendar access expired. Reconnect.',
    );
  }
  return response.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  }>;
}

async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { email?: string };
  return json.email?.toLowerCase() ?? null;
}

async function fetchMicrosoftEmail(accessToken: string): Promise<string | null> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const json = (await response.json()) as {
    mail?: string;
    userPrincipalName?: string;
  };
  return (json.mail || json.userPrincipalName || '').toLowerCase() || null;
}

function nextAllDayDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function upsertGoogleEvent(
  accessToken: string,
  calendarId: string,
  event: CalendarEvent,
  reminderMinutes: number,
  externalEventId: string | null,
): Promise<string> {
  const payload = {
    summary: event.title,
    description: eventDescription(event),
    start: { date: event.date },
    end: { date: nextAllDayDate(event.date) },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: reminderMinutes },
        { method: 'email', minutes: Math.max(reminderMinutes, 60) },
      ],
    },
  };

  const encodedCalendar = encodeURIComponent(calendarId || 'primary');
  const url = externalEventId
    ? `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendar}/events/${encodeURIComponent(externalEventId)}`
    : `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendar}/events`;

  const response = await fetch(url, {
    method: externalEventId ? 'PATCH' : 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(502, 'google_calendar_write_failed', text.slice(0, 200));
  }
  const json = (await response.json()) as { id: string };
  return json.id;
}

async function upsertMicrosoftEvent(
  accessToken: string,
  event: CalendarEvent,
  reminderMinutes: number,
  externalEventId: string | null,
): Promise<string> {
  const start = `${event.date}T09:00:00`;
  const end = `${event.date}T10:00:00`;
  const payload = {
    subject: event.title,
    body: {
      contentType: 'Text',
      content: eventDescription(event),
    },
    start: { dateTime: start, timeZone: 'UTC' },
    end: { dateTime: end, timeZone: 'UTC' },
    isReminderOn: true,
    reminderMinutesBeforeStart: reminderMinutes,
  };

  const url = externalEventId
    ? `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(externalEventId)}`
    : 'https://graph.microsoft.com/v1.0/me/events';

  const response = await fetch(url, {
    method: externalEventId ? 'PATCH' : 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(502, 'microsoft_calendar_write_failed', text.slice(0, 200));
  }
  const json = (await response.json()) as { id: string };
  return json.id;
}

async function getValidAccessToken(
  sql: Database,
  config: AppConfig,
  connection: ConnectionRow,
): Promise<string> {
  const access = decryptSecret(connection.accessTokenEnc, tokenSecret(config));
  const expiresAt = connection.tokenExpiresAt
    ? new Date(connection.tokenExpiresAt).getTime()
    : 0;
  if (expiresAt > Date.now() + 60_000) return access;

  if (!connection.refreshTokenEnc) {
    throw new ApiError(401, 'calendar_reconnect_required', 'Reconnect your calendar.');
  }
  const refresh = decryptSecret(connection.refreshTokenEnc, tokenSecret(config));

  if (connection.provider === 'google') {
    const tokens = await refreshGoogleAccess(config, refresh);
    const expires = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);
    await sql`
      UPDATE calendar_connections
      SET access_token_enc = ${encryptSecret(tokens.access_token, tokenSecret(config))},
          token_expires_at = ${expires},
          updated_at = now()
      WHERE id = ${connection.id}
    `;
    return tokens.access_token;
  }

  const tokens = await refreshMicrosoftAccess(config, refresh);
  const expires = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);
  await sql`
    UPDATE calendar_connections
    SET access_token_enc = ${encryptSecret(tokens.access_token, tokenSecret(config))},
        refresh_token_enc = ${
          tokens.refresh_token
            ? encryptSecret(tokens.refresh_token, tokenSecret(config))
            : connection.refreshTokenEnc
        },
        token_expires_at = ${expires},
        updated_at = now()
    WHERE id = ${connection.id}
  `;
  return tokens.access_token;
}

export function registerCalendarSyncRoutes(
  app: FastifyInstance,
  sql: Database,
  config: AppConfig,
  auth: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authenticate: any;
  },
): void {
  app.get('/v1/calendar/connections', { preHandler: auth.authenticate }, async (request) => {
    const userId = (request as { authUser: { id: string } }).authUser.id;
    const rows = await sql<ConnectionRow[]>`
      SELECT
        id, user_id, provider, account_email, access_token_enc, refresh_token_enc,
        token_expires_at, scope, calendar_id, sync_tasks, sync_payments, sync_paydays,
        reminder_minutes, last_synced_at
      FROM calendar_connections
      WHERE user_id = ${userId}
      ORDER BY provider ASC
    `;
    return {
      providers: {
        google: googleConfigured(config),
        microsoft: microsoftConfigured(config),
      },
      connections: rows.map((row) => ({
        id: row.id,
        provider: row.provider,
        accountEmail: row.accountEmail,
        calendarId: row.calendarId,
        syncTasks: row.syncTasks,
        syncPayments: row.syncPayments,
        syncPaydays: row.syncPaydays,
        reminderMinutes: row.reminderMinutes,
        lastSyncedAt: row.lastSyncedAt,
      })),
    };
  });

  app.post(
    '/v1/calendar/connect/:provider',
    { preHandler: auth.authenticate },
    async (request) => {
      const userId = (request as { authUser: { id: string } }).authUser.id;
      const { provider } = z
        .object({ provider: z.enum(['google', 'microsoft']) })
        .parse(request.params);
      const body = z
        .object({
          redirectPath: z.string().trim().max(200).default('/?tab=calendar'),
        })
        .parse(request.body ?? {});

      if (provider === 'google' && !googleConfigured(config)) {
        throw new ApiError(503, 'google_calendar_unconfigured', 'Google Calendar is not configured.');
      }
      if (provider === 'microsoft' && !microsoftConfigured(config)) {
        throw new ApiError(
          503,
          'microsoft_calendar_unconfigured',
          'Microsoft calendar is not configured.',
        );
      }

      const state = base64Url(randomBytes(24));
      const { verifier, challenge } = pkcePair();
      const expires = new Date(Date.now() + 15 * 60 * 1000);
      await sql`
        INSERT INTO calendar_oauth_states (state, user_id, provider, code_verifier, redirect_path, expires_at)
        VALUES (${state}, ${userId}, ${provider}, ${verifier}, ${body.redirectPath}, ${expires})
      `;

      if (provider === 'google') {
        const params = new URLSearchParams({
          client_id: config.googleClientIds[0]!,
          redirect_uri: callbackUrl(config, 'google'),
          response_type: 'code',
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/calendar.events',
          ].join(' '),
          access_type: 'offline',
          prompt: 'consent',
          state,
          code_challenge: challenge,
          code_challenge_method: 'S256',
        });
        return {
          url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
        };
      }

      const tenant = config.microsoftTenantId || 'common';
      const params = new URLSearchParams({
        client_id: config.microsoftClientId!,
        redirect_uri: callbackUrl(config, 'microsoft'),
        response_type: 'code',
        response_mode: 'query',
        scope: 'openid profile email offline_access Calendars.ReadWrite',
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      });
      return {
        url: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`,
      };
    },
  );

  app.get('/v1/calendar/oauth/:provider/callback', async (request, reply) => {
    const { provider } = z
      .object({ provider: z.enum(['google', 'microsoft']) })
      .parse(request.params);
    const query = z
      .object({
        code: z.string().optional(),
        state: z.string().optional(),
        error: z.string().optional(),
      })
      .parse(request.query);

    const fail = (message: string) =>
      reply.redirect(
        `${config.publicAppUrl}/?tab=calendar&calendar_error=${encodeURIComponent(message)}`,
      );

    if (query.error || !query.code || !query.state) {
      return fail(query.error || 'oauth_cancelled');
    }

    const [oauthState] = await sql<
      {
        state: string;
        userId: string;
        provider: Provider;
        codeVerifier: string | null;
        redirectPath: string;
        expiresAt: Date;
      }[]
    >`
      SELECT state, user_id, provider, code_verifier, redirect_path, expires_at
      FROM calendar_oauth_states
      WHERE state = ${query.state}
    `;
    await sql`DELETE FROM calendar_oauth_states WHERE state = ${query.state}`;
    if (!oauthState || oauthState.provider !== provider) {
      return fail('invalid_oauth_state');
    }
    if (new Date(oauthState.expiresAt).getTime() < Date.now()) {
      return fail('oauth_state_expired');
    }

    try {
      const tokens =
        provider === 'google'
          ? await exchangeGoogleCode(config, query.code, oauthState.codeVerifier)
          : await exchangeMicrosoftCode(config, query.code, oauthState.codeVerifier);

      const email =
        provider === 'google'
          ? await fetchGoogleEmail(tokens.access_token)
          : await fetchMicrosoftEmail(tokens.access_token);

      const expires = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);
      const accessEnc = encryptSecret(tokens.access_token, tokenSecret(config));
      const refreshEnc = tokens.refresh_token
        ? encryptSecret(tokens.refresh_token, tokenSecret(config))
        : null;

      const [existing] = await sql<{ id: string; refreshTokenEnc: string | null }[]>`
        SELECT id, refresh_token_enc
        FROM calendar_connections
        WHERE user_id = ${oauthState.userId} AND provider = ${provider}
      `;

      if (existing) {
        await sql`
          UPDATE calendar_connections
          SET account_email = ${email},
              access_token_enc = ${accessEnc},
              refresh_token_enc = COALESCE(${refreshEnc}, refresh_token_enc),
              token_expires_at = ${expires},
              scope = ${tokens.scope ?? null},
              updated_at = now()
          WHERE id = ${existing.id}
        `;
      } else {
        await sql`
          INSERT INTO calendar_connections (
            user_id, provider, account_email, access_token_enc, refresh_token_enc,
            token_expires_at, scope, calendar_id
          ) VALUES (
            ${oauthState.userId}, ${provider}, ${email}, ${accessEnc}, ${refreshEnc},
            ${expires}, ${tokens.scope ?? null}, ${provider === 'google' ? 'primary' : 'default'}
          )
        `;
      }

      const path = oauthState.redirectPath.startsWith('/')
        ? oauthState.redirectPath
        : '/?tab=calendar';
      const joiner = path.includes('?') ? '&' : '?';
      return reply.redirect(
        `${config.publicAppUrl}${path}${joiner}calendar_connected=${provider}`,
      );
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'calendar_connect_failed';
      return fail(message);
    }
  });

  app.patch(
    '/v1/calendar/connections/:id',
    { preHandler: auth.authenticate },
    async (request) => {
      const userId = (request as { authUser: { id: string } }).authUser.id;
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = z
        .object({
          syncTasks: z.boolean().optional(),
          syncPayments: z.boolean().optional(),
          syncPaydays: z.boolean().optional(),
          reminderMinutes: z.number().int().min(0).max(10080).optional(),
          calendarId: z.string().trim().min(1).max(200).optional(),
        })
        .parse(request.body);

      const [updated] = await sql`
        UPDATE calendar_connections
        SET
          sync_tasks = COALESCE(${body.syncTasks ?? null}, sync_tasks),
          sync_payments = COALESCE(${body.syncPayments ?? null}, sync_payments),
          sync_paydays = COALESCE(${body.syncPaydays ?? null}, sync_paydays),
          reminder_minutes = COALESCE(${body.reminderMinutes ?? null}, reminder_minutes),
          calendar_id = COALESCE(${body.calendarId ?? null}, calendar_id),
          updated_at = now()
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING id
      `;
      if (!updated) throw new ApiError(404, 'connection_not_found', 'Calendar connection not found.');
      return { ok: true };
    },
  );

  app.delete(
    '/v1/calendar/connections/:id',
    { preHandler: auth.authenticate },
    async (request) => {
      const userId = (request as { authUser: { id: string } }).authUser.id;
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      await sql`
        DELETE FROM calendar_connections
        WHERE id = ${id} AND user_id = ${userId}
      `;
      return replyOk();
    },
  );

  function replyOk() {
    return { ok: true };
  }

  app.post(
    '/v1/calendar/sync',
    { preHandler: auth.authenticate },
    async (request) => {
      const userId = (request as { authUser: { id: string } }).authUser.id;
      const body = z
        .object({
          connectionId: z.string().uuid().optional(),
          months: z.number().int().min(1).max(3).default(1),
        })
        .parse(request.body ?? {});

      const connections = await sql<ConnectionRow[]>`
        SELECT
          id, user_id, provider, account_email, access_token_enc, refresh_token_enc,
          token_expires_at, scope, calendar_id, sync_tasks, sync_payments, sync_paydays,
          reminder_minutes, last_synced_at
        FROM calendar_connections
        WHERE user_id = ${userId}
          AND (${body.connectionId ?? null}::uuid IS NULL OR id = ${body.connectionId ?? null})
      `;
      if (connections.length === 0) {
        throw new ApiError(400, 'no_calendar_connection', 'Connect Google or Microsoft Calendar first.');
      }

      const now = new Date();
      let pushed = 0;

      for (const connection of connections) {
        const types: string[] = [];
        if (connection.syncTasks) {
          types.push('task');
          types.push('milestone');
        }
        if (connection.syncPayments) types.push('payment');
        if (connection.syncPaydays) types.push('payday');
        if (types.length === 0) continue;

        const accessToken = await getValidAccessToken(sql, config, connection);
        const links = await sql<{ lifeEventKey: string; externalEventId: string }[]>`
          SELECT life_event_key, external_event_id
          FROM calendar_sync_links
          WHERE connection_id = ${connection.id}
        `;
        const linkMap = new Map(links.map((row) => [row.lifeEventKey, row.externalEventId]));

        for (let offset = 0; offset < body.months; offset += 1) {
          const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
          const loaded = await loadCalendarEvents(sql, userId, {
            view: 'month',
            year: cursor.getUTCFullYear(),
            month: cursor.getUTCMonth() + 1,
            types,
          });

          for (const event of loaded.events) {
            const existingId = linkMap.get(event.id) ?? null;
            const externalId =
              connection.provider === 'google'
                ? await upsertGoogleEvent(
                    accessToken,
                    connection.calendarId || 'primary',
                    event,
                    connection.reminderMinutes,
                    existingId,
                  )
                : await upsertMicrosoftEvent(
                    accessToken,
                    event,
                    connection.reminderMinutes,
                    existingId,
                  );

            await sql`
              INSERT INTO calendar_sync_links (connection_id, life_event_key, external_event_id, last_synced_at)
              VALUES (${connection.id}, ${event.id}, ${externalId}, now())
              ON CONFLICT (connection_id, life_event_key)
              DO UPDATE SET external_event_id = EXCLUDED.external_event_id, last_synced_at = now()
            `;
            linkMap.set(event.id, externalId);
            pushed += 1;
          }
        }

        await sql`
          UPDATE calendar_connections
          SET last_synced_at = now(), updated_at = now()
          WHERE id = ${connection.id}
        `;
      }

      return { ok: true, pushed };
    },
  );
}
