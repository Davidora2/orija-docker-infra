import express from 'express';
import mqtt from 'mqtt';
import pg from 'pg';
import {
  TOPICS,
  EVENT_TYPES,
  createNotifyRequest,
} from '@smart-home/shared';

const {
  MQTT_URL = 'mqtt://mosquitto:1883',
  MQTT_USERNAME = 'smarthome',
  MQTT_PASSWORD = 'smarthome',
  DATABASE_URL = 'postgres://smarthome:smarthome@postgres:5432/smarthome',
  PORT = '3102',
} = process.env;

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const app = express();
app.use(express.json());

let mqttClient;
const rulesCache = new Map();

async function loadRules() {
  const { rows } = await pool.query(
    `SELECT id, home_id, name, trigger_type, conditions, actions, enabled
     FROM automation_rules WHERE enabled = true`
  );
  rulesCache.clear();
  for (const row of rows) {
    const list = rulesCache.get(row.home_id) ?? [];
    list.push(row);
    rulesCache.set(row.home_id, list);
  }
  console.log(`[event-processor] loaded ${rows.length} automation rules`);
}

function renderTemplate(template, ctx) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) =>
    ctx[key] != null ? String(ctx[key]) : ''
  );
}

async function handleDeviceEvent(event) {
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

  const rules = rulesCache.get(event.homeId) ?? [];
  const matched = rules.filter((r) => r.trigger_type === event.type);

  for (const rule of matched) {
    for (const action of rule.actions ?? []) {
      if (action.type !== 'notify') continue;

      const deviceName = event.payload?.name ?? event.deviceId;
      const req = createNotifyRequest({
        homeId: event.homeId,
        correlationId: event.id,
        channels: action.channels ?? ['fcm', 'console'],
        title: action.title ?? 'Smart Home',
        body: renderTemplate(action.bodyTemplate ?? 'Event: {{type}}', {
          deviceName,
          type: event.type,
          source: event.source,
        }),
        data: {
          deviceId: event.deviceId,
          eventType: event.type,
          ruleId: rule.id,
        },
      });

      const topic = TOPICS.notifyRequest(event.homeId);
      mqttClient.publish(topic, JSON.stringify(req), { qos: 1 });
      console.log(
        `[event-processor] rule "${rule.name}" → notify ${req.id} channels=${req.channels.join(',')}`
      );
    }
  }
}

function connectMqtt() {
  mqttClient = mqtt.connect(MQTT_URL, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    clientId: `event-processor-${process.pid}`,
    reconnectPeriod: 2000,
  });

  mqttClient.on('connect', () => {
    console.log('[event-processor] MQTT connected');
    mqttClient.subscribe(TOPICS.allHomesDeviceEvents, { qos: 1 });
  });

  mqttClient.on('message', (topic, buf) => {
    try {
      const event = JSON.parse(buf.toString());
      if (!event?.type || !event?.homeId) return;
      if (
        event.type === EVENT_TYPES.DEVICE_ONLINE ||
        event.type === EVENT_TYPES.DEVICE_OFFLINE
      ) {
        return;
      }
      handleDeviceEvent(event).catch((err) =>
        console.error('[event-processor] handle failed', err)
      );
    } catch (err) {
      console.error('[event-processor] bad message on', topic, err.message);
    }
  });

  mqttClient.on('error', (err) =>
    console.error('[event-processor] MQTT error', err.message)
  );
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'event-processor',
    mqtt: mqttClient?.connected ?? false,
    rules: [...rulesCache.values()].flat().length,
  });
});

app.post('/admin/reload-rules', async (_req, res) => {
  await loadRules();
  res.json({ reloaded: true });
});

async function main() {
  await pool.query('SELECT 1');
  await loadRules();
  connectMqtt();
  setInterval(() => loadRules().catch(console.error), 60_000);
  app.listen(Number(PORT), () =>
    console.log(`[event-processor] listening on :${PORT}`)
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
