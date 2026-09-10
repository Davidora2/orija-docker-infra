import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { config } from "./config.js";

function readAll() {
  return JSON.parse(fs.readFileSync(config.requestsFile, "utf8"));
}

function writeAll(rows) {
  fs.writeFileSync(config.requestsFile, `${JSON.stringify(rows, null, 2)}\n`);
}

export function listRequests() {
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getRequest(id) {
  return readAll().find((r) => r.id === id) || null;
}

export function ensureOpenDrop() {
  const existing = getRequest("open");
  if (existing) {
    if (existing.closed) setClosed("open", false);
    return getRequest("open");
  }
  const rows = readAll();
  const request = {
    id: "open",
    title: "Send photos",
    description: "Drop photos or videos. No account needed.",
    createdBy: "system",
    createdAt: new Date().toISOString(),
    closed: false,
    files: [],
  };
  rows.push(request);
  writeAll(rows);
  fs.mkdirSync(path.join(config.uploadRoot, request.id), { recursive: true });
  return request;
}

export function createRequest({ title, description, createdBy }) {
  const rows = readAll();
  const request = {
    id: nanoid(10),
    title: String(title || "").trim() || "Photo request",
    description: String(description || "").trim(),
    createdBy: String(createdBy || "admin").trim() || "admin",
    createdAt: new Date().toISOString(),
    closed: false,
    files: [],
  };
  rows.push(request);
  writeAll(rows);
  fs.mkdirSync(path.join(config.uploadRoot, request.id), { recursive: true });
  return request;
}

export function setClosed(id, closed) {
  const rows = readAll();
  const row = rows.find((r) => r.id === id);
  if (!row) return null;
  row.closed = Boolean(closed);
  writeAll(rows);
  return row;
}

export function addFile(id, fileMeta) {
  const rows = readAll();
  const row = rows.find((r) => r.id === id);
  if (!row) return null;
  row.files.push(fileMeta);
  writeAll(rows);
  return row;
}

export function markFileMoved(requestId, fileId, destination) {
  const rows = readAll();
  const row = rows.find((r) => r.id === requestId);
  if (!row) return null;
  const file = row.files.find((f) => f.id === fileId);
  if (!file) return null;
  file.movedAt = new Date().toISOString();
  file.destination = destination;
  writeAll(rows);
  return file;
}

export function deleteFileRecord(requestId, fileId) {
  const rows = readAll();
  const row = rows.find((r) => r.id === requestId);
  if (!row) return null;
  const idx = row.files.findIndex((f) => f.id === fileId);
  if (idx === -1) return null;
  const [removed] = row.files.splice(idx, 1);
  writeAll(rows);
  return removed;
}
