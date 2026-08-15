import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pg from 'pg';

const {
  DATABASE_URL = 'postgres://smarthome:smarthome@postgres:5432/smarthome',
  DEMO_API_KEY = 'sh_demo_key_change_me',
  HOME_ID = '11111111-1111-1111-1111-111111111111',
  RING_BRIDGE_URL = 'http://ring-bridge:3101',
  PORT = '3100',
} = process.env;

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '64kb' }));
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

function hashKey(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function ensureDemoApiKey() {
  const keyHash = hashKey(DEMO_API_KEY);
  await pool.query(
    `INSERT INTO api_keys (home_id, name, key_hash, scopes)
     VALUES ($1, 'dashboard', $2, ARRAY['read','write','admin'])
     ON CONFLICT (key_hash) DO NOTHING`,
    [HOME_ID, keyHash]
  );
  // Remove empty placeholder from init.sql if present
  await pool.query(
    `DELETE FROM api_keys WHERE key_hash = $1`,
    ['e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855']
  );
}

async function auth(req, res, next) {
  const header = req.header('authorization') || '';
  const apiKey =
    (header.startsWith('Bearer ') ? header.slice(7) : null) ||
    req.header('x-api-key');

  if (!apiKey) {
    return res.status(401).json({ error: 'missing_api_key' });
  }

  const { rows } = await pool.query(
    `SELECT id, home_id, scopes FROM api_keys
     WHERE key_hash = $1 AND revoked_at IS NULL`,
    [hashKey(apiKey)]
  );

  if (!rows[0]) {
    return res.status(401).json({ error: 'invalid_api_key' });
  }

  req.auth = {
    keyId: rows[0].id,
    homeId: rows[0].home_id,
    scopes: rows[0].scopes,
  };
  next();
}

function requireScope(scope) {
  return (req, res, next) => {
    if (!req.auth?.scopes?.includes(scope) && !req.auth?.scopes?.includes('admin')) {
      return res.status(403).json({ error: 'forbidden', need: scope });
    }
    next();
  };
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'api-gateway' });
});

app.get('/v1/home', auth, requireScope('read'), async (req, res) => {
  const { rows } = await pool.query(`SELECT id, name, created_at FROM homes WHERE id = $1`, [
    req.auth.homeId,
  ]);
  res.json(rows[0] ?? null);
});

app.get('/v1/devices', auth, requireScope('read'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, device_type, source, online, last_seen_at, metadata
     FROM devices WHERE home_id = $1 ORDER BY name`,
    [req.auth.homeId]
  );
  res.json({ devices: rows });
});

app.get('/v1/events', auth, requireScope('read'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const { rows } = await pool.query(
    `SELECT id, device_id, event_type, source, payload, occurred_at, ingested_at
     FROM event_log WHERE home_id = $1
     ORDER BY occurred_at DESC LIMIT $2`,
    [req.auth.homeId, limit]
  );
  res.json({ events: rows });
});

app.get('/v1/notifications', auth, requireScope('read'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const { rows } = await pool.query(
    `SELECT id, correlation_id, channel, title, body, status, detail, created_at
     FROM notification_log WHERE home_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [req.auth.homeId, limit]
  );
  res.json({ notifications: rows });
});

app.get('/v1/rules', auth, requireScope('read'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, enabled, trigger_type, conditions, actions, created_at
     FROM automation_rules WHERE home_id = $1 ORDER BY created_at`,
    [req.auth.homeId]
  );
  res.json({ rules: rows });
});

/** Trigger a doorbell ring via the Ring bridge (mock or real). */
app.post('/v1/doorbell/ring', auth, requireScope('write'), async (req, res) => {
  try {
    const upstream = await fetch(`${RING_BRIDGE_URL}/simulate/ring`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        actor: req.body?.actor ?? 'api-gateway',
        dingId: req.body?.dingId,
      }),
    });
    const body = await upstream.json();
    res.status(upstream.status).json(body);
  } catch (err) {
    res.status(502).json({ error: 'ring_bridge_unreachable', detail: err.message });
  }
});

async function main() {
  await pool.query('SELECT 1');
  await ensureDemoApiKey();
  console.log(`[api-gateway] demo API key ready (hash only stored)`);
  app.listen(Number(PORT), () =>
    console.log(`[api-gateway] listening on :${PORT}`)
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
