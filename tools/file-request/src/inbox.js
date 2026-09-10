import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { config } from "./config.js";

const CHUNK_SIZE = Number(process.env.CHUNK_SIZE_BYTES) || 8 * 1024 * 1024; // 8 MiB — under Cloudflare’s ~100MB request cap

function inboxRoot() {
  const dir = path.join(config.uploadRoot, "_inbox");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function sessionDir(id) {
  return path.join(inboxRoot(), id);
}

function readMeta(id) {
  const file = path.join(sessionDir(id), "meta.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeMeta(meta) {
  const dir = sessionDir(meta.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
}

export function startUpload({ token, filename, size, mime, createdAt }) {
  const id = nanoid(12);
  const safe = String(filename || "upload")
    .replace(/[^\w.\- ()[\]]+/g, "_")
    .slice(0, 180);
  const meta = {
    id,
    token,
    filename: safe,
    size: Number(size) || 0,
    mime: mime || "application/octet-stream",
    createdAt: createdAt || new Date().toISOString(),
    chunkSize: CHUNK_SIZE,
    received: [],
  };
  writeMeta(meta);
  return { uploadId: id, chunkSize: CHUNK_SIZE, unlimited: true };
}

export function getUpload(uploadId, token) {
  const meta = readMeta(uploadId);
  if (!meta || (token && meta.token !== token)) return null;
  return meta;
}

export function saveChunk(uploadId, index, buffer, token) {
  const meta = getUpload(uploadId, token);
  if (!meta) throw new Error("Upload not found");
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0) throw new Error("Bad chunk index");
  if (!buffer?.length) throw new Error("Empty chunk");
  if (buffer.length > meta.chunkSize + 1024) throw new Error("Chunk too large");
  fs.writeFileSync(path.join(sessionDir(uploadId), `${i}.part`), buffer);
  if (!meta.received.includes(i)) meta.received.push(i);
  meta.received.sort((a, b) => a - b);
  writeMeta(meta);
  return { ok: true, received: meta.received.length, unlimited: true };
}

export function assembleUpload(uploadId, token) {
  const meta = getUpload(uploadId, token);
  if (!meta) throw new Error("Upload not found");
  const maxIdx = meta.received.length ? Math.max(...meta.received) : -1;
  const expected = meta.size > 0 ? Math.ceil(meta.size / meta.chunkSize) : maxIdx + 1;
  if (expected < 1) throw new Error("No chunks received");
  const assembled = path.join(sessionDir(uploadId), meta.filename);
  const fd = fs.openSync(assembled, "w");
  try {
    for (let i = 0; i < expected; i++) {
      const part = path.join(sessionDir(uploadId), `${i}.part`);
      if (!fs.existsSync(part)) throw new Error(`Missing chunk ${i}`);
      const data = fs.readFileSync(part);
      fs.writeSync(fd, data);
    }
  } finally {
    fs.closeSync(fd);
  }
  const stat = fs.statSync(assembled);
  return { ...meta, filePath: assembled, size: stat.size };
}

export function cleanupUpload(uploadId) {
  const dir = sessionDir(uploadId);
  fs.rmSync(dir, { recursive: true, force: true });
}

export { CHUNK_SIZE };
