import express from 'express';
import mqtt from 'mqtt';
import pg from 'pg';
import {
  TOPICS,
  EVENT_TYPES,
  createEvent,
} from '@smart-home/shared';

const {
  HOME_ID = '11111111-1111-1111-1111-111111111111',
  DEVICE_ID = 'ring-doorbell-1',
  DEVICE_NAME = 'Front Door Ring',
  MQTT_URL = 'mqtt://mosquitto:1883',
  MQTT_USERNAME = 'smarthome',
  MQTT_PASSWORD = 'smarthome',
  DATABASE_URL = 'postgres://smarthome:smarthome@postgres:5432/smarthome',
  RING_REFRESH_TOKEN = '',
  MOCK_MODE = 'true',
  PORT = '3101',
} = process.env;

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const app = express();
app.use(express.json());

let mqttClient;
const seenDingIds = new Set();

function connectMqtt() {
  mqttClient = mqtt.connect(MQTT_URL, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    clientId: `ring-bridge-${DEVICE_ID}`,
    reconnectPeriod: 2000,
  });

  mqttClient.on('connect', () => {
    console.log('[ring-bridge] MQTT connected');
    publishOnline(true);
  });
  mqttClient.on('error', (err) => console.error('[ring-bridge] MQTT error', err.message));
}

async function persistEvent(event) {
  await pool.query(
    `INSERT INTO event_log (id, home_id, device_id, event_type, source, payload, occurred_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (id) DO NOTHING`,
    [
      event.id,
      event.homeId,
      event.deviceId,
      event.type,
      event.source,
      JSON.stringify(event.payload ?? {}),
      event.occurredAt,
    ]
  );
}

function publishOnline(online) {
  const event = createEvent({
    homeId: HOME_ID,
    deviceId: DEVICE_ID,
    deviceType: 'doorbell',
    type: online ? EVENT_TYPES.DEVICE_ONLINE : EVENT_TYPES.DEVICE_OFFLINE,
    source: MOCK_MODE === 'true' ? 'mock' : 'ring',
    payload: { name: DEVICE_NAME },
  });
  const topic = TOPICS.deviceEvent(HOME_ID, DEVICE_ID, event.type);
  mqttClient?.publish(topic, JSON.stringify(event), { qos: 1 });
}

async function publishDoorbellRung({ source = 'mock', dingId, extra = {} } = {}) {
  if (dingId) {
    if (seenDingIds.has(dingId)) return null;
    seenDingIds.add(dingId);
    if (seenDingIds.size > 500) {
      const first = seenDingIds.values().next().value;
      seenDingIds.delete(first);
    }
  }

  const event = createEvent({
    homeId: HOME_ID,
    deviceId: DEVICE_ID,
    deviceType: 'doorbell',
    type: EVENT_TYPES.DOORBELL_RUNG,
    source,
    payload: {
      name: DEVICE_NAME,
      dingId: dingId ?? null,
      ...extra,
    },
    labels: { location: 'front_door' },
  });

  await persistEvent(event);
  const topic = TOPICS.deviceEvent(HOME_ID, DEVICE_ID, EVENT_TYPES.DOORBELL_RUNG);
  mqttClient.publish(topic, JSON.stringify(event), { qos: 1 });
  console.log('[ring-bridge] published doorbell.rung', event.id);
  return event;
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'ring-bridge',
    mockMode: MOCK_MODE === 'true',
    mqtt: mqttClient?.connected ?? false,
  });
});

/** Simulate a Ring button press (used by dashboard & demos). */
app.post('/simulate/ring', async (req, res) => {
  try {
    const event = await publishDoorbellRung({
      source: 'mock',
      dingId: req.body?.dingId,
      extra: { simulatedBy: req.body?.actor ?? 'api' },
    });
    res.status(202).json({ accepted: true, event });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

async function startRealRing() {
  if (!RING_REFRESH_TOKEN) {
    console.warn('[ring-bridge] No RING_REFRESH_TOKEN — staying in mock mode');
    return;
  }
  const { RingApi } = await import('ring-client-api');
  const ringApi = new RingApi({
    refreshToken: RING_REFRESH_TOKEN,
    cameraStatusPollingSeconds: 20,
  });

  const cameras = await ringApi.getCameras();
  const doorbell =
    cameras.find((c) => c.name?.toLowerCase().includes('door')) ?? cameras[0];

  if (!doorbell) {
    console.warn('[ring-bridge] No Ring cameras/doorbells found');
    return;
  }

  console.log(`[ring-bridge] Watching Ring device: ${doorbell.name}`);
  doorbell.onDoorbellPressed.subscribe((ding) => {
    publishDoorbellRung({
      source: 'ring',
      dingId: String(ding?.id ?? ding?.ding_id ?? Date.now()),
      extra: { ringName: doorbell.name },
    }).catch((err) => console.error('[ring-bridge] ding publish failed', err));
  });
}

async function main() {
  connectMqtt();
  await pool.query('SELECT 1');
  console.log('[ring-bridge] DB ready');

  if (MOCK_MODE !== 'true') {
    await startRealRing();
  } else {
    console.log('[ring-bridge] MOCK_MODE=true — POST /simulate/ring to trigger events');
  }

  app.listen(Number(PORT), () => {
    console.log(`[ring-bridge] listening on :${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

process.on('SIGTERM', () => {
  publishOnline(false);
  mqttClient?.end();
  pool.end().finally(() => process.exit(0));
});
