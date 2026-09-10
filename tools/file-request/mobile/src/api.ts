import { File, Paths } from "expo-file-system";

export type InboxInfo = {
  ok: boolean;
  label: string;
  destination: { user: string; album: string };
  chunkSize: number;
  unlimited?: boolean;
};

export function normalizeServerUrl(raw: string) {
  let url = String(raw || "").trim();
  if (!url) throw new Error("Enter the server URL from Admin → Phone inboxes");
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.replace(/\/$/, "");
}

function join(url: string, path: string) {
  return `${normalizeServerUrl(url)}${path}`;
}

async function readJson(res: Response) {
  return res.json().catch(() => ({} as { error?: string }));
}

function friendlyNetworkError(error: unknown, serverUrl: string) {
  const message = error instanceof Error ? error.message : String(error);
  if (/Network request failed|Failed to fetch|TypeError/i.test(message)) {
    return `Cannot reach ${serverUrl}. Use the public HTTPS inbox URL, or http://YOUR-LAN-IP:13847 on the same Wi-Fi.`;
  }
  return message;
}

export async function pingInbox(serverUrl: string, token: string): Promise<InboxInfo> {
  const url = normalizeServerUrl(serverUrl);
  if (!token.trim()) throw new Error("Enter the phone token from Admin → Phone inboxes");
  try {
    const res = await fetch(join(url, `/api/inbox/${encodeURIComponent(token.trim())}`));
    const data = await readJson(res);
    if (res.status === 404) {
      throw new Error("This server does not have a phone inbox (wrong URL, or the live stack is outdated).");
    }
    if (!res.ok) throw new Error(data.error || `Cannot reach server (${res.status})`);
    return data as InboxInfo;
  } catch (error) {
    throw new Error(friendlyNetworkError(error, url));
  }
}

async function putChunk(url: string, body: BodyInit, attempt = 1): Promise<void> {
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "content-type": "application/octet-stream" },
      body,
    });
    if (!res.ok) {
      const err = await readJson(res);
      throw new Error(err.error || `Chunk failed (${res.status})`);
    }
  } catch (error) {
    if (attempt >= 8) throw error;
    await new Promise((r) => setTimeout(r, Math.min(15_000, 500 * 2 ** attempt)));
    return putChunk(url, body, attempt + 1);
  }
}

function safeName(name: string) {
  return String(name || "upload").replace(/[^\w.\-]+/g, "_").slice(0, 180);
}

function asBlob(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes);
  return new Blob([copy]);
}

function openLocalFile(uri: string, name: string) {
  const source = new File(uri);
  if (uri.startsWith("file://") && source.exists) return source;
  const dest = new File(Paths.cache, `immich-send-${Date.now()}-${safeName(name)}`);
  try {
    source.copy(dest);
    return dest;
  } catch {
    return source;
  }
}

async function blobFromUri(uri: string) {
  const res = await fetch(uri);
  return res.blob();
}

export async function uploadFile(
  serverUrl: string,
  token: string,
  file: { uri: string; name: string; mime: string; size?: number },
  onProgress?: (done: number, total: number) => void,
) {
  const url = normalizeServerUrl(serverUrl);
  let size = file.size || 0;
  let useHandle: { offset: number | null; readBytes(length: number): Uint8Array; close(): void } | null = null;
  let blob: Blob | null = null;

  try {
    const local = openLocalFile(file.uri, file.name);
    if (local.size) size = local.size;
    useHandle = local.open();
  } catch {
    blob = await blobFromUri(file.uri);
    size = size || blob.size;
  }

  if (!size) throw new Error("Could not read the file size");

  const initRes = await fetch(join(url, `/api/inbox/${encodeURIComponent(token)}/uploads`), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      size,
      mime: file.mime || "application/octet-stream",
      createdAt: new Date().toISOString(),
    }),
  });
  const started = await readJson(initRes);
  if (!initRes.ok) throw new Error(started.error || "Could not start upload");
  const chunkSize = Number(started.chunkSize) || 8 * 1024 * 1024;
  const uploadId = started.uploadId as string;
  const totalChunks = Math.max(1, Math.ceil(size / chunkSize));

  try {
    for (let i = 0; i < totalChunks; i++) {
      const offset = i * chunkSize;
      const length = Math.min(chunkSize, size - offset);
      let body: BodyInit;
      if (useHandle) {
        useHandle.offset = offset;
        body = asBlob(useHandle.readBytes(length));
      } else {
        body = blob!.slice(offset, offset + length);
      }
      await putChunk(
        join(url, `/api/inbox/${encodeURIComponent(token)}/uploads/${uploadId}/chunks/${i}`),
        body,
      );
      onProgress?.(i + 1, totalChunks);
    }
  } finally {
    try {
      useHandle?.close();
    } catch {
      /* ignore */
    }
  }

  const doneRes = await fetch(join(url, `/api/inbox/${encodeURIComponent(token)}/uploads/${uploadId}/complete`), {
    method: "POST",
  });
  const done = await readJson(doneRes);
  if (!doneRes.ok) throw new Error(done.error || "Immich upload failed");
  return done;
}

export const KEYS = {
  url: "immich-send-url",
  token: "immich-send-token",
};

export const DEFAULT_SERVER_URL = "https://inbox.orija.store";
