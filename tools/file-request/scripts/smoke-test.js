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

  const denied = await request("GET", "/api/admin/requests");
  assert(denied.status === 401, "admin should require password");

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
  assert(row.files.length === 1, "file not listed");

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

  const adminPage = await request("GET", "/admin");
  assert(adminPage.status === 200 && adminPage.raw.toString().includes("File Requests"), "admin html missing");
  const reqPage = await request("GET", `/r/${id}`);
  assert(reqPage.status === 200 && reqPage.raw.toString().includes("Drop photos"), "request html missing");

  console.log("smoke-test ok");
} finally {
  child.kill("SIGTERM");
}
