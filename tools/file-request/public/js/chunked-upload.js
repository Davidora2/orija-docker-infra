const CHUNK_TIMEOUT_MS = 45_000;

function toArrayBuffer(blob) {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Could not read file"));
    reader.readAsArrayBuffer(blob);
  });
}

async function putChunk(url, body, onRetry) {
  let lastError = new Error("Chunk upload failed");
  for (let attempt = 1; attempt <= 8; attempt++) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), CHUNK_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "content-type": "application/octet-stream" },
        body,
        signal: controller.signal,
      });
      if (res.ok) return;
      const err = await res.json().catch(() => ({}));
      lastError = new Error(err.error || `Chunk failed (${res.status})`);
      if (res.status === 400 && !/interrupt|retry/i.test(String(err.error || ""))) {
        throw lastError;
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        lastError = new Error("Upload stalled, retrying…");
      } else if (error instanceof Error) {
        lastError = error;
      } else {
        lastError = new Error(String(error));
      }
    } finally {
      window.clearTimeout(timer);
    }
    onRetry?.(attempt);
    await new Promise((r) => setTimeout(r, Math.min(8_000, 400 * 2 ** attempt)));
  }
  throw lastError;
}

export async function uploadFileInChunks({ startUrl, chunkPath, completeUrl, file, extraComplete = {}, onProgress }) {
  const size = file.size;
  const initRes = await fetch(startUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      filename: file.name || "upload",
      size,
      mime: file.type || "application/octet-stream",
      createdAt: file.lastModified ? new Date(file.lastModified).toISOString() : new Date().toISOString(),
    }),
  });
  const started = await initRes.json().catch(() => ({}));
  if (!initRes.ok) throw new Error(started.error || "Could not start upload");
  const chunkSize = Number(started.chunkSize) || 1 * 1024 * 1024;
  const uploadId = started.uploadId;
  const totalChunks = Math.max(1, Math.ceil((size || 1) / chunkSize));
  for (let i = 0; i < totalChunks; i++) {
    const slice = file.slice(i * chunkSize, Math.min(size, (i + 1) * chunkSize));
    const body = await toArrayBuffer(slice);
    await putChunk(chunkPath(uploadId, i), body, () => {
      onProgress?.(i + 1, totalChunks, file.name, { retrying: true });
    });
    onProgress?.(i + 1, totalChunks, file.name);
  }
  const doneRes = await fetch(completeUrl(uploadId), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(extraComplete),
  });
  const done = await doneRes.json().catch(() => ({}));
  if (!doneRes.ok) throw new Error(done.error || "Upload failed");
  return done;
}
