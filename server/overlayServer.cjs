const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { createBibleIndex, lookupReference, searchText, parseReference } = require('./bible.cjs');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function startOverlayServer({ port, overlayDir, biblePath, getSettings }) {
  let bible = null;
  try {
    const raw = JSON.parse(fs.readFileSync(biblePath, 'utf8'));
    bible = createBibleIndex(raw);
  } catch (err) {
    console.warn('Bible data not loaded:', err.message);
    bible = createBibleIndex({ translation: 'WEB', books: [] });
  }

  let currentVerse = null;
  let captions = '';
  const clients = new Set();

  function broadcast(message) {
    const data = JSON.stringify(message);
    for (const ws of clients) {
      if (ws.readyState === 1) ws.send(data);
    }
  }

  function sendState(ws) {
    const settings = getSettings();
    ws.send(JSON.stringify({ type: 'theme', payload: settings.theme }));
    ws.send(JSON.stringify({ type: 'verse', payload: currentVerse }));
    ws.send(JSON.stringify({ type: 'captions', payload: captions }));
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const pathname = url.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');

    if (pathname === '/api/state') {
      const settings = getSettings();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ theme: settings.theme, verse: currentVerse, captions }));
      return;
    }

    if (pathname === '/api/verse' && req.method === 'GET') {
      const ref = url.searchParams.get('ref') || '';
      const verse = lookupReference(bible, ref);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(verse));
      return;
    }

    const routeMap = {
      '/': 'preview.html',
      '/lower-third': 'lower-third.html',
      '/captions': 'captions.html',
      '/preview': 'preview.html',
    };

    let filePath = null;
    if (routeMap[pathname]) {
      filePath = path.join(overlayDir, routeMap[pathname]);
    } else if (pathname.startsWith('/assets/')) {
      filePath = path.join(overlayDir, pathname.slice(1));
    }

    if (!filePath || !fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws) => {
    clients.add(ws);
    sendState(ws);
    ws.on('close', () => clients.delete(ws));
  });

  return new Promise((resolve, reject) => {
    const tryListen = (p, attemptsLeft) => {
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
          tryListen(p + 1, attemptsLeft - 1);
        } else {
          reject(err);
        }
      });
      server.listen(p, '127.0.0.1', () => {
        const actualPort = server.address().port;
        console.log(`VerseCast overlay server on http://127.0.0.1:${actualPort}`);
        resolve({
          port: actualPort,
          broadcast,
          setCurrentVerse: (v) => {
            currentVerse = v;
          },
          setCaptions: (t) => {
            captions = t;
          },
          lookupVerse: (ref) => lookupReference(bible, ref),
          searchVerses: (q) => searchText(bible, q),
          getBooks: () => bible.bookNames,
          parseReference: (text) => parseReference(text),
          close: () => {
            wss.close();
            server.close();
          },
        });
      });
    };
    tryListen(port, 20);
  });
}

module.exports = { startOverlayServer };
