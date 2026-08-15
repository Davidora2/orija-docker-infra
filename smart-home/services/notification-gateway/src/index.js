import express from 'express';
import mqtt from 'mqtt';
import pg from 'pg';
import { GoogleAuth } from 'google-auth-library';
import { TOPICS, NOTIFY_CHANNELS } from '@smart-home/shared';

const {
  MQTT_URL = 'mqtt://mosquitto:1883',
  MQTT_USERNAME = 'smarthome',
  MQTT_PASSWORD = 'smarthome',
  DATABASE_URL = 'postgres://smarthome:smarthome@postgres:5432/smarthome',
  FCM_DEVICE_TOKEN = '',
  FCM_PROJECT_ID = '',
  GOOGLE_APPLICATION_CREDENTIALS = '',
  GOOGLE_HOME_WEBHOOK_URL = '',
  NOTIFY_WEBHOOK_URL = '',
  PORT = '3103',
} = process.env;

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const app = express();
app.use(express.json());

let mqttClient;
let fcmClient = null;

async function initFcm() {
  if (!FCM_PROJECT_ID || !GOOGLE_APPLICATION_CREDENTIALS) {
    console.log(
      '[notify] FCM credentials not set — using console/webhook channels only'
    );
    return;
  }
  try {
    const auth = new GoogleAuth({
      keyFile: GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });
    fcmClient = await auth.getClient();
    console.log('[notify] FCM client ready for project', FCM_PROJECT_ID);
  } catch (err) {
    console.warn('[notify] FCM init failed:', err.message);
  }
}

async function sendFcm(title, body, data = {}) {
  if (!fcmClient || !FCM_DEVICE_TOKEN || !FCM_PROJECT_ID) {
    return {
      status: 'skipped',
      detail: {
        reason: 'fcm_not_configured',
        hint: 'Set FCM_PROJECT_ID, GOOGLE_APPLICATION_CREDENTIALS, FCM_DEVICE_TOKEN',
      },
    };
  }

  const url = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`;
  const message = {
    message: {
      token: FCM_DEVICE_TOKEN,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: 'high',
        notification: { channelId: 'smart_home', sound: 'default' },
      },
    },
  };

  const res = await fcmClient.request({ url, method: 'POST', data: message });
  return { status: 'sent', detail: { fcm: res.data } };
}

async function sendGoogleHomeBroadcast(title, body) {
  // Scalable hook: cast/broadcast via Home Assistant, Nest, or custom webhook.
  if (!GOOGLE_HOME_WEBHOOK_URL) {
    return {
      status: 'skipped',
      detail: {
        reason: 'google_home_webhook_not_configured',
        spokenText: `${title}. ${body}`,
      },
    };
  }
  const res = await fetch(GOOGLE_HOME_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: `${title}. ${body}`,
      source: 'smart-home-notification-gateway',
    }),
  });
  return {
    status: res.ok ? 'sent' : 'failed',
    detail: { httpStatus: res.status },
  };
}

async function sendWebhook(title, body, data) {
  if (!NOTIFY_WEBHOOK_URL) {
    return { status: 'skipped', detail: { reason: 'webhook_not_configured' } };
  }
  const res = await fetch(NOTIFY_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title, body, data }),
  });
  return {
    status: res.ok ? 'sent' : 'failed',
    detail: { httpStatus: res.status },
  };
}

function sendConsole(title, body, data) {
  console.log(
    `[notify:console] ${title} — ${body}`,
    JSON.stringify(data ?? {})
  );
  return { status: 'sent', detail: { channel: 'console' } };
}

async function logNotification(row) {
  await pool.query(
    `INSERT INTO notification_log
      (id, home_id, correlation_id, channel, title, body, status, detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      crypto.randomUUID(),
      row.homeId,
      row.correlationId,
      row.channel,
      row.title,
      row.body,
      row.status,
      JSON.stringify(row.detail ?? {}),
    ]
  );
}

async function handleNotifyRequest(req) {
  const channels = req.channels?.length
    ? req.channels
    : [NOTIFY_CHANNELS.CONSOLE];

  const results = [];
  for (const channel of channels) {
    let result;
    try {
      switch (channel) {
        case NOTIFY_CHANNELS.FCM:
          result = await sendFcm(req.title, req.body, req.data);
          break;
        case NOTIFY_CHANNELS.GOOGLE_HOME_BROADCAST:
          result = await sendGoogleHomeBroadcast(req.title, req.body);
          break;
        case NOTIFY_CHANNELS.WEBHOOK:
          result = await sendWebhook(req.title, req.body, req.data);
          break;
        case NOTIFY_CHANNELS.CONSOLE:
        default:
          result = sendConsole(req.title, req.body, req.data);
          break;
      }
    } catch (err) {
      result = { status: 'failed', detail: { error: err.message } };
    }

    await logNotification({
      homeId: req.homeId,
      correlationId: req.correlationId,
      channel,
      title: req.title,
      body: req.body,
      status: result.status,
      detail: result.detail,
    });
    results.push({ channel, ...result });
  }

  const out = {
    id: req.id,
    homeId: req.homeId,
    correlationId: req.correlationId,
    results,
    completedAt: new Date().toISOString(),
  };
  mqttClient.publish(
    TOPICS.notifyResult(req.homeId),
    JSON.stringify(out),
    { qos: 0 }
  );
  return out;
}

function connectMqtt() {
  mqttClient = mqtt.connect(MQTT_URL, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    clientId: `notification-gateway-${process.pid}`,
    reconnectPeriod: 2000,
  });

  mqttClient.on('connect', () => {
    console.log('[notify] MQTT connected');
    mqttClient.subscribe('home/+/notify/request', { qos: 1 });
  });

  mqttClient.on('message', (_topic, buf) => {
    try {
      const req = JSON.parse(buf.toString());
      handleNotifyRequest(req).catch((err) =>
        console.error('[notify] handle failed', err)
      );
    } catch (err) {
      console.error('[notify] bad message', err.message);
    }
  });
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'notification-gateway',
    mqtt: mqttClient?.connected ?? false,
    fcmConfigured: Boolean(fcmClient && FCM_DEVICE_TOKEN),
  });
});

/** Direct send for testing without MQTT. */
app.post('/notify', async (req, res) => {
  try {
    const out = await handleNotifyRequest({
      id: crypto.randomUUID(),
      homeId: req.body.homeId,
      correlationId: req.body.correlationId ?? crypto.randomUUID(),
      channels: req.body.channels ?? ['console'],
      title: req.body.title ?? 'Test',
      body: req.body.body ?? 'Test notification',
      data: req.body.data ?? {},
    });
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function main() {
  await pool.query('SELECT 1');
  await initFcm();
  connectMqtt();
  app.listen(Number(PORT), () =>
    console.log(`[notify] listening on :${PORT}`)
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
