type InboxInfo = {
  ok: boolean;
  label: string;
  destination: { user: string; album: string };
  chunkSize: number;
  unlimited?: boolean;
};

function join(url: string, path: string) {
  return `${url.replace(/\/$/, "")}${path}`;
}

async function readJson(res: Response) {
  return res.json().catch(() => ({} as { error?: string }));
}

export async function pingInbox(serverUrl: string, token: string): Promise<InboxInfo> {
  const res = await fetch(join(serverUrl, `/api/inbox/${encodeURIComponent(token)}`));
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.error || `Cannot reach server (${res.status})`);
  return data as InboxInfo;
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

async function loadFileSystem(): Promise<typeof import("expo-file-system") | null> {
  try {
    return await import("expo-file-system");
  } catch {
    return null;
  }
}

async function localFileUri(
  FileSystem: typeof import("expo-file-system"),
  uri: string,
  name: string,
): Promise<string> {
  if (uri.startsWith("file://")) return uri;
  const dest = `${FileSystem.cacheDirectory}immich-send-${Date.now()}-${name.replace(/[^\w.\-]+/g, "_")}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

async function readChunk(
  FileSystem: typeof import("expo-file-system"),
  uri: string,
  position: number,
  length: number,
): Promise<BodyInit> {
  const EncodingType = FileSystem.EncodingType || { Base64: "base64" };
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: EncodingType.Base64,
    position,
    length,
  } as Parameters<typeof FileSystem.readAsStringAsync>[1]);
  const res = await fetch(`data:application/octet-stream;base64,${b64}`);
  return res.blob();
}

export async function uploadFile(
  serverUrl: string,
  token: string,
  file: { uri: string; name: string; mime: string; size?: number },
  onProgress?: (done: number, total: number) => void,
) {
  const FileSystem = await loadFileSystem();
  let localUri = file.uri;
  let size = file.size || 0;
  let copied = false;

  if (FileSystem) {
    localUri = await localFileUri(FileSystem, file.uri, file.name);
    copied = localUri !== file.uri;
    const info = await FileSystem.getInfoAsync(localUri);
    if (info.exists && "size" in info && typeof info.size === "number") size = info.size;
  }

  if (!size && !FileSystem) {
    const blob = await (await fetch(file.uri)).blob();
    size = blob.size;
  }

  const initRes = await fetch(join(serverUrl, `/api/inbox/${encodeURIComponent(token)}/uploads`), {
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
  const totalChunks = Math.max(1, Math.ceil((size || 1) / chunkSize));

  try {
    if (FileSystem) {
      for (let i = 0; i < totalChunks; i++) {
        const offset = i * chunkSize;
        const length = Math.min(chunkSize, size - offset);
        const body = await readChunk(FileSystem, localUri, offset, length);
        await putChunk(
          join(serverUrl, `/api/inbox/${encodeURIComponent(token)}/uploads/${uploadId}/chunks/${i}`),
          body,
        );
        onProgress?.(i + 1, totalChunks);
      }
    } else {
      const blob = await (await fetch(file.uri)).blob();
      for (let i = 0; i < totalChunks; i++) {
        const slice = blob.slice(i * chunkSize, Math.min(blob.size, (i + 1) * chunkSize));
        await putChunk(
          join(serverUrl, `/api/inbox/${encodeURIComponent(token)}/uploads/${uploadId}/chunks/${i}`),
          slice,
        );
        onProgress?.(i + 1, totalChunks);
      }
    }
  } finally {
    if (copied && FileSystem) {
      await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => undefined);
    }
  }

  const doneRes = await fetch(
    join(serverUrl, `/api/inbox/${encodeURIComponent(token)}/uploads/${uploadId}/complete`),
    { method: "POST" },
  );
  const done = await readJson(doneRes);
  if (!doneRes.ok) throw new Error(done.error || "Immich upload failed");
  return done;
}

export const KEYS = {
  url: "immich-send-url",
  token: "immich-send-token",
};

export type { InboxInfo };
