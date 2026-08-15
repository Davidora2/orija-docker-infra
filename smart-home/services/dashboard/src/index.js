import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const {
  PORT = '8080',
  API_GATEWAY_URL = 'http://api-gateway:3100',
  DEMO_API_KEY = 'sh_demo_key_change_me',
} = process.env;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/config.js', (_req, res) => {
  res
    .type('application/javascript')
    .send(`window.SMART_HOME = ${JSON.stringify({ apiBase: '/api' })};`);
});

/** Proxy to API gateway with server-side API key (secrets stay off the client). */
app.use('/api', async (req, res) => {
  const upstreamPath = req.originalUrl.replace(/^\/api/, '/v1');
  const url = `${API_GATEWAY_URL}${upstreamPath}`;

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers: {
        'content-type': 'application/json',
        'x-api-key': DEMO_API_KEY,
      },
      body: ['GET', 'HEAD'].includes(req.method)
        ? undefined
        : JSON.stringify(req.body ?? {}),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.type(upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (err) {
    res.status(502).json({ error: 'api_unreachable', detail: err.message });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true, service: 'dashboard' }));

app.listen(Number(PORT), () => {
  console.log(`[dashboard] http://0.0.0.0:${PORT}`);
});
