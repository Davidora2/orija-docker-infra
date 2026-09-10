import fs from "node:fs";
import { nanoid } from "nanoid";
import { config } from "./config.js";

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(config.settingsFile, "utf8"));
  } catch {
    return { immichUrl: "", users: [] };
  }
}

function writeSettings(settings) {
  fs.writeFileSync(config.settingsFile, `${JSON.stringify(settings, null, 2)}\n`);
}

export function getSettings() {
  const settings = readSettings();
  return {
    immichUrl: settings.immichUrl || "",
    users: Array.isArray(settings.users) ? settings.users : [],
    devices: Array.isArray(settings.devices) ? settings.devices : [],
  };
}

export function publicSettings() {
  const settings = getSettings();
  return {
    immichUrl: settings.immichUrl,
    connected: Boolean(settings.immichUrl && settings.users.length),
    users: settings.users.map(publicUser),
    devices: settings.devices.map(publicDevice),
  };
}

export function publicDevice(device) {
  const user = getUser(device.userId);
  return {
    id: device.id,
    token: device.token,
    label: device.label || "Phone",
    userId: device.userId,
    userLabel: user?.label || user?.name || "",
    albumId: device.albumId || "",
    albumName: device.albumName || "Library",
    createdAt: device.createdAt,
  };
}

export function publicUser(user) {
  const key = user.apiKey || "";
  return {
    id: user.id,
    label: user.label || user.name || user.email || "Immich user",
    name: user.name || "",
    email: user.email || "",
    immichUserId: user.immichUserId || "",
    apiKeyMasked: key ? `••••${key.slice(-4)}` : "",
  };
}

export function setImmichUrl(url) {
  const settings = getSettings();
  settings.immichUrl = String(url || "").trim().replace(/\/$/, "");
  writeSettings(settings);
  return publicSettings();
}

export function upsertUser({ apiKey, label, profile }) {
  const settings = getSettings();
  const key = String(apiKey || "").trim();
  if (!key) throw new Error("API key is required");
  const existing =
    settings.users.find((u) => u.apiKey === key) ||
    settings.users.find((u) => u.immichUserId && u.immichUserId === profile?.id);
  const row = existing || { id: nanoid(8), apiKey: key };
  row.apiKey = key;
  row.label = String(label || profile?.name || profile?.email || row.label || "Immich user").trim();
  row.name = profile?.name || row.name || "";
  row.email = profile?.email || row.email || "";
  row.immichUserId = profile?.id || row.immichUserId || "";
  if (!existing) settings.users.push(row);
  writeSettings(settings);
  return publicUser(row);
}

export function removeUser(id) {
  const settings = getSettings();
  settings.users = settings.users.filter((u) => u.id !== id);
  writeSettings(settings);
  return publicSettings();
}

export function getUser(id) {
  return getSettings().users.find((u) => u.id === id) || null;
}

export function listDevices() {
  return getSettings().devices.map(publicDevice);
}

export function getDeviceByToken(token) {
  return getSettings().devices.find((d) => d.token === token) || null;
}

export function createDevice({ label, userId, albumId, albumName }) {
  const settings = getSettings();
  const user = settings.users.find((u) => u.id === userId);
  if (!user) throw new Error("Select an Immich user for this phone");
  const device = {
    id: nanoid(8),
    token: nanoid(20),
    label: String(label || "Phone").trim() || "Phone",
    userId: user.id,
    albumId: albumId || "",
    albumName: albumName || "Library",
    createdAt: new Date().toISOString(),
  };
  settings.devices = settings.devices || [];
  settings.devices.push(device);
  writeSettings(settings);
  return publicDevice(device);
}

export function removeDevice(id) {
  const settings = getSettings();
  settings.devices = (settings.devices || []).filter((d) => d.id !== id);
  writeSettings(settings);
  return publicSettings();
}
