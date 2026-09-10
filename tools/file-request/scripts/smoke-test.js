#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "file-request-"));
const inbox = path.join(tmp, "inbox");
const family = path.join(tmp, "family");
const dataDir = path.join(tmp, "data");
fs.mkdirSync(inbox);
fs.mkdirSync(family);
fs.mkdirSync(dataDir);

const mockState = {
  albums: [{ id: "album-family", albumName: "Family", assetCount: 2 }],
  uploads: [],
  albumAdds: [],
};

const mock = http.createServer((req, res) => {
  const key = req.headers["x-api-key"];
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (key !== "maya-key") {
    send(401, { message: "Invalid API key" });
    return;
  }
  const url = new URL(req.url, "http://immich.test");
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    if (req.method === "GET" && url.pathname === "/api/users/me") {
      send(200, { id: "user-maya", name: "Maya", email: "maya@home" });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/albums") {
      send(200, mockState.albums);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/albums") {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      const album = { id: "album-new", albumName: body.albumName, assetCount: 0 };
      mockState.albums.push(album);
      send(201, album);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/assets") {
      const asset = { id: `asset-${mockState.uploads.length + 1}`, status: "created" };
      mockState.uploads.push({ asset, bytes: Buffer.concat(chunks).length });
      send(201, asset);
      return;
    }
    if (req.method === "PUT" && url.pathname.endsWith("/assets")) {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      mockState.albumAdds.push({ path: url.pathname, ids: body.ids });
      send(200, (body.ids || []).map((id) => ({ id, success: true })));
      return;
    }
    send(404, { message: `no mock ${req.method} ${url.pathname}` });
  });
});

const mockPort = 38480;
await new Promise((resolve) => mock.listen(mockPort, "127.0.0.1", resolve));

const port = 38479;
const child = spawn(process.execPath, [path.join(root, "src/server.js")], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(port),
    BASE_URL: `http://127.0.0.1:${port}`,
    ADMIN_PASSWORD: "test-pass",
    DATA_DIR: dataDir,
    UPLOAD_ROOT: path.join(dataDir, "uploads"),
    IMMICH_FOLDERS: `Inbox=${inbox},Family=${family}`,
    CHUNK_SIZE_BYTES: "32",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let out = "";
child.stdout.on("data", (d) => {
  out += d.toString();
});
child.stderr.on("data", (d) => process.stderr.write(d));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function request(method, urlPath, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "127.0.0.1", port, path: urlPath, method, headers },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks);
          let json = null;
          try {
            json = JSON.parse(raw.toString("utf8"));
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode, json, raw });
        });
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function multipartBody(fields, files) {
  const boundary = `----testdata${Date.now()}`;
  const parts = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
  }
  for (const file of files) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`,
    );
    parts.push(file.buffer);
    parts.push("\r\n");
  }
  parts.push(`--${boundary}--\r\n`);
  const body = Buffer.concat(parts.map((p) => (Buffer.isBuffer(p) ? p : Buffer.from(p))));
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

function tinyPng() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}

await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("timeout starting server: " + out)), 8000);
  const onData = (chunk) => {
    out += chunk.toString();
    if (/listening on/i.test(out)) {
      clearTimeout(t);
      resolve();
    }
  };
  child.stdout.on("data", onData);
  child.on("exit", (code) => {
    if (!/listening on/i.test(out)) reject(new Error("server exited " + code + " " + out));
  });
});

const auth = { "x-admin-password": "test-pass" };

try {
  const health = await request("GET", "/api/health");
  assert(health.status === 200 && health.json.ok, "health failed");
  assert(health.json.unlimitedUploads === true, "health should report unlimited uploads");

  const openMeta = await request("GET", "/api/open");
  assert(openMeta.json.ok && openMeta.json.unlimited === true, "open inbox missing");
  const openBytes = Buffer.concat([tinyPng(), Buffer.alloc(40, 9)]);
  const openStart = await request("POST", "/api/open/uploads", {
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filename: "phone.jpg", size: openBytes.length, mime: "image/jpeg" }),
  });
  assert(openStart.status === 201 && openStart.json.uploadId, "open start failed");
  const openChunkSize = Number(openStart.json.chunkSize);
  const openChunks = Math.ceil(openBytes.length / openChunkSize);
  for (let i = 0; i < openChunks; i++) {
    const slice = openBytes.subarray(i * openChunkSize, Math.min(openBytes.length, (i + 1) * openChunkSize));
    const put = await request("PUT", `/api/open/uploads/${openStart.json.uploadId}/chunks/${i}`, {
      headers: { "content-type": "application/octet-stream", "content-length": String(slice.length) },
      body: slice,
    });
    assert(put.json?.ok, `open chunk ${i} failed`);
  }
  const openDone = await request("POST", `/api/open/uploads/${openStart.json.uploadId}/complete`, {
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  assert(openDone.status === 201 && openDone.json.count === 1, "open complete failed: " + JSON.stringify(openDone.json));

  const denied = await request("GET", "/api/admin/requests");
  assert(denied.status === 401, "admin should require password");

  const inbox = await request("GET", "/api/admin/requests", { headers: auth });
  assert(inbox.json[0]?.id === "open", "open inbox should be first in admin list");
  assert(
    inbox.json[0].files.some((f) => f.originalName === "phone.jpg"),
    "guest upload missing from open inbox",
  );

  const adminPage = await request("GET", "/admin");
  assert(adminPage.status === 200, "admin page missing");
  const adminHtml = fs.readFileSync(path.join(root, "public", "admin.html"), "utf8");
  assert(!adminHtml.includes('href="/css/app.css"'), "admin CSS must be prefix-safe");
  assert(!adminHtml.includes('src="/js/admin.js"'), "admin JS must be prefix-safe");
  const adminJs = fs.readFileSync(path.join(root, "public", "js", "admin.js"), "utf8");
  assert(adminJs.includes("apiUrl"), "admin JS must prefix API calls");
  assert(adminJs.includes('OPEN_ID'), "admin JS must auto-open the guest inbox");

  const created = await request("POST", "/api/admin/requests", {
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ title: "Weekend photos", description: "Please send originals" }),
  });
  assert(created.status === 201 && created.json.id, "create failed");
  const id = created.json.id;
  assert(created.json.uploadUrl.includes(`/r/${id}`), "upload url missing");

  const publicMeta = await request("GET", `/api/requests/${id}`);
  assert(publicMeta.json.title === "Weekend photos", "public meta mismatch");
  assert(!("files" in publicMeta.json), "public meta should hide files");
  assert(publicMeta.json.unlimited === true, "public request should be unlimited");
  assert(publicMeta.json.chunkSize > 0, "chunk size missing");

  const chunkBytes = Buffer.concat([tinyPng(), Buffer.alloc(40, 3)]);
  const chunkStart = await request("POST", `/api/requests/${id}/uploads`, {
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filename: "big-video.mp4", size: chunkBytes.length, mime: "video/mp4" }),
  });
  assert(chunkStart.status === 201 && chunkStart.json.uploadId, "chunked start failed: " + JSON.stringify(chunkStart.json));
  const requestChunkSize = Number(chunkStart.json.chunkSize);
  const nChunks = Math.ceil(chunkBytes.length / requestChunkSize);
  assert(nChunks > 1, "smoke chunk size should force multiple chunks");
  for (let i = 0; i < nChunks; i++) {
    const slice = chunkBytes.subarray(i * requestChunkSize, Math.min(chunkBytes.length, (i + 1) * requestChunkSize));
    const put = await request("PUT", `/api/requests/${id}/uploads/${chunkStart.json.uploadId}/chunks/${i}`, {
      headers: { "content-type": "application/octet-stream", "content-length": String(slice.length) },
      body: slice,
    });
    assert(put.json?.ok, `request chunk ${i} failed: ` + JSON.stringify(put.json));
  }
  const chunkDone = await request("POST", `/api/requests/${id}/uploads/${chunkStart.json.uploadId}/complete`, {
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ uploaderName: "Alex", note: "chunked" }),
  });
  assert(chunkDone.status === 201 && chunkDone.json.count === 1, "chunked complete failed: " + JSON.stringify(chunkDone.json));

  const { body, contentType } = multipartBody(
    { uploaderName: "Alex", note: "Saturday" },
    [{ name: "shot.png", type: "image/png", buffer: tinyPng() }],
  );
  const uploaded = await request("POST", `/api/requests/${id}/upload`, {
    headers: { "content-type": contentType, "content-length": String(body.length) },
    body,
  });
  assert(uploaded.status === 201 && uploaded.json.count === 1, "upload failed: " + JSON.stringify(uploaded.json));
  const fileId = uploaded.json.files[0].id;

  const listed = await request("GET", "/api/admin/requests", { headers: auth });
  const row = listed.json.find((r) => r.id === id);
  assert(row.files.length === 2, "files not listed");

  const savedUrl = await request("PUT", "/api/admin/immich/url", {
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ url: `http://127.0.0.1:${mockPort}` }),
  });
  assert(savedUrl.status === 200 && savedUrl.json.immichUrl.includes(String(mockPort)), "save url failed");

  const badKey = await request("POST", "/api/admin/immich/users", {
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ apiKey: "nope", label: "Bad" }),
  });
  assert(badKey.status === 401, "bad key should fail");

  const added = await request("POST", "/api/admin/immich/users", {
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ apiKey: "maya-key", label: "Maya" }),
  });
  assert(added.status === 201 && added.json.email === "maya@home", "add user failed: " + JSON.stringify(added.json));
  assert(!JSON.stringify(added.json).includes("maya-key"), "api key leaked");
  const userId = added.json.id;

  const device = await request("POST", "/api/admin/devices", {
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ label: "Pixel", userId, albumId: "album-family", albumName: "Family" }),
  });
  assert(device.status === 201 && device.json.token, "device create failed: " + JSON.stringify(device.json));
  const token = device.json.token;
  const inboxMeta = await request("GET", `/api/inbox/${token}`);
  assert(inboxMeta.json.ok && inboxMeta.json.chunkSize > 0, "inbox ping failed");

  const payload = Buffer.concat([tinyPng(), Buffer.alloc(64, 7)]);
  const started = await request("POST", `/api/inbox/${token}/uploads`, {
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filename: "clip.bin", size: payload.length, mime: "application/octet-stream" }),
  });
  assert(started.status === 201 && started.json.uploadId, "inbox start failed: " + JSON.stringify(started.json));
  const inboxChunkSize = Number(started.json.chunkSize);
  const inboxChunks = Math.ceil(payload.length / inboxChunkSize);
  for (let i = 0; i < inboxChunks; i++) {
    const slice = payload.subarray(i * inboxChunkSize, Math.min(payload.length, (i + 1) * inboxChunkSize));
    const chunkPut = await request("PUT", `/api/inbox/${token}/uploads/${started.json.uploadId}/chunks/${i}`, {
      headers: { "content-type": "application/octet-stream", "content-length": String(slice.length) },
      body: slice,
    });
    assert(chunkPut.json?.ok, `inbox chunk ${i} failed: ` + JSON.stringify(chunkPut.json));
  }
  const completed = await request("POST", `/api/inbox/${token}/uploads/${started.json.uploadId}/complete`);
  assert(completed.json?.ok && completed.json.assetId, "inbox complete failed: " + JSON.stringify(completed.json));
  assert(mockState.uploads.length === 1, "phone upload did not reach Immich");

  const albums = await request("GET", `/api/admin/immich/users/${userId}/albums`, { headers: auth });
  assert(albums.json.some((a) => a.name === "Family"), "albums missing: " + JSON.stringify(albums.json));

  const sent = await request("POST", "/api/admin/send-to-immich", {
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({
      requestId: id,
      fileIds: [fileId],
      userId,
      albumId: "album-family",
      albumName: "Family",
    }),
  });
  assert(sent.json.ok, "send to immich failed: " + JSON.stringify(sent.json));
  assert(mockState.uploads.length === 2, "immich did not receive second upload");
  assert(mockState.albumAdds.length === 2, "immich did not receive album add");
  assert(sent.json.results[0].assetId === "asset-2", "asset id mismatch");

  const afterSend = await request("GET", "/api/admin/requests", { headers: auth });
  const sentFile = afterSend.json.find((r) => r.id === id).files.find((f) => f.id === fileId);
  assert(sentFile.destination.kind === "immich", "destination not marked immich");
  assert(sentFile.destination.albumName === "Family", "album name not stored");

  const moved = await request("POST", "/api/admin/move", {
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ requestId: id, fileIds: [fileId], folderId: "family", mode: "copy" }),
  });
  assert(moved.json.ok, "move failed: " + JSON.stringify(moved.json));
  const destFiles = fs.readdirSync(family);
  assert(
    destFiles.some((n) => n.toLowerCase().includes("shot")),
    "file not in family folder: " + destFiles.join(","),
  );

  const closed = await request("POST", `/api/admin/requests/${id}/close`, {
    headers: { ...auth, "content-type": "application/json" },
    body: "{}",
  });
  assert(closed.json.closed === true, "close failed");

  const lateParts = multipartBody({}, [{ name: "late.png", type: "image/png", buffer: tinyPng() }]);
  const late = await request("POST", `/api/requests/${id}/upload`, {
    headers: { "content-type": lateParts.contentType, "content-length": String(lateParts.body.length) },
    body: lateParts.body,
  });
  assert(late.status === 403, "closed request should reject uploads");

  const lateChunk = await request("POST", `/api/requests/${id}/uploads`, {
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filename: "late.mp4", size: 10, mime: "video/mp4" }),
  });
  assert(lateChunk.status === 403, "closed request should reject chunked uploads");

  const adminHtmlPage = await request("GET", "/admin");
  assert(adminHtmlPage.status === 200 && adminHtmlPage.raw.toString().includes("Send to Immich"), "admin html missing");
  const reqPage = await request("GET", `/r/${id}`);
  assert(reqPage.status === 200 && reqPage.raw.toString().includes("Drop photos"), "request html missing");

  console.log("smoke-test ok");
} finally {
  child.kill("SIGTERM");
  mock.close();
}
