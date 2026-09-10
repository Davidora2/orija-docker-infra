import { File, Paths } from "expo-file-system";

export type InboxInfo = {
  ok: boolean;
  label: string;
  destination: { user: string; album: string };
  chunkSize: number;
  unlimited?: boolean;
};

export const DEFAULT_SERVER_URL = "https://lifeos.orija.store/send";

export function normalizeServerUrl(raw: string) {
  let url = String(raw || DEFAULT_SERVER_URL).trim();
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
    return `Cannot reach ${serverUrl}. Check internet and try again.`;
  }
  return message;
}

export async function pingInbox(serverUrl: string = DEFAULT_SERVER_URL): Promise<InboxInfo> {
  const url = normalizeServerUrl(serverUrl);
  try {
    const res = await fetch(join(url, "/api/open"));
    const data = await readJson(res);
    if (!res.ok) throw new Error(data.error || `Cannot reach server (${res.status})`);
    return data as InboxInfo;
  } catch (error) {
    throw new Error(friendlyNetworkError(error, url));
  }
}

async function putChunk(url: string, body: BodyInit, attempt = 1): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "content-type": "application/octet-stream" },
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await readJson(res);
      throw new Error(err.error || `Chunk failed (${res.status})`);
    }
  } catch (error) {
    if (attempt >= 8) {
      throw error instanceof Error && error.name === "AbortError"
        ? new Error("Upload stalled. Check the connection and try again.")
        : error;
    }
    await new Promise((r) => setTimeout(r, Math.min(8_000, 400 * 2 ** attempt)));
    return putChunk(url, body, attempt + 1);
  } finally {
    clearTimeout(timer);
  }
}

function safeName(name: string) {
  return String(name || "upload").replace(/[^\w.\-]+/g, "_").slice(0, 180);
}

function asBlob(bytes: Uint8Array) {
  return new Blob([new Uint8Array(bytes)]);
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

export async function uploadFile(
  serverUrl: string,
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
    blob = await (await fetch(file.uri)).blob();
    size = size || blob.size;
  }

  if (!size) throw new Error("Could not read the file size");

  const initRes = await fetch(join(url, "/api/open/uploads"), {
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
      const body = useHandle
        ? ((useHandle.offset = offset), asBlob(useHandle.readBytes(length)))
        : blob!.slice(offset, offset + length);
      await putChunk(join(url, `/api/open/uploads/${uploadId}/chunks/${i}`), body);
      onProgress?.(i + 1, totalChunks);
    }
  } finally {
    try {
      useHandle?.close();
    } catch {
      /* ignore */
    }
  }

  const doneRes = await fetch(join(url, `/api/open/uploads/${uploadId}/complete`), { method: "POST" });
  const done = await readJson(doneRes);
  if (!doneRes.ok) throw new Error(done.error || "Upload failed");
  return done;
}
