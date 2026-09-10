import { openAsBlob } from "node:fs";
import { Agent, fetch as undiciFetch } from "undici";

const immichAgent = new Agent({
  headersTimeout: 0,
  bodyTimeout: 0,
  connectTimeout: 30_000,
});

export function apiBase(url) {
  const trimmed = String(url || "").trim().replace(/\/$/, "");
  if (!trimmed) throw new Error("Immich URL is not configured");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

async function parseBody(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function immichRequest(url, apiKey, path, { method = "GET", headers = {}, body, raw } = {}) {
  const res = await undiciFetch(`${apiBase(url)}${path}`, {
    method,
    body,
    dispatcher: immichAgent,
    headers: {
      Accept: "application/json",
      "x-api-key": apiKey,
      ...headers,
    },
  });
  const data = raw ? null : await parseBody(res);
  if (!res.ok) {
    const message =
      (data && (data.message || data.error || data.errorMessage)) ||
      (typeof data === "string" && data.slice(0, 300)) ||
      `Immich ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    error.details = data;
    throw error;
  }
  return data;
}

export async function getMe(url, apiKey) {
  return immichRequest(url, apiKey, "/users/me");
}

export async function listAlbums(url, apiKey) {
  const albums = await immichRequest(url, apiKey, "/albums");
  return (Array.isArray(albums) ? albums : []).map((album) => ({
    id: album.id,
    name: album.albumName || album.name || "Album",
    assetCount: album.assetCount ?? album.assets?.length ?? 0,
  }));
}

export async function createAlbum(url, apiKey, name) {
  const album = await immichRequest(url, apiKey, "/albums", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ albumName: name }),
  });
  return { id: album.id, name: album.albumName || name };
}

export async function uploadAsset(url, apiKey, { filePath, filename, mime, createdAt, modifiedAt, deviceAssetId }) {
  const blob = await openAsBlob(filePath, { type: mime || "application/octet-stream" });
  const form = new FormData();
  form.append("assetData", blob, filename);
  form.append("deviceAssetId", deviceAssetId || `${filename}-${createdAt}`);
  form.append("deviceId", "immich-file-request");
  form.append("fileCreatedAt", createdAt || new Date().toISOString());
  form.append("fileModifiedAt", modifiedAt || createdAt || new Date().toISOString());
  form.append("filename", filename);

  const data = await immichRequest(url, apiKey, "/assets", {
    method: "POST",
    body: form,
  });
  return {
    id: data.id,
    status: data.status || "created",
    duplicate: String(data.status || "").toLowerCase() === "duplicate",
  };
}

export async function addToAlbum(url, apiKey, albumId, assetIds) {
  if (!albumId || !assetIds?.length) return [];
  return immichRequest(url, apiKey, `/albums/${albumId}/assets`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids: assetIds }),
  });
}
