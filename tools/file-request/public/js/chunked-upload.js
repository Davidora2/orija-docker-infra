async function putChunk(url, body) {
  let lastError = new Error("Chunk upload failed");
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "content-type": "application/octet-stream" },
        body,
      });
      if (res.ok) return;
      const err = await res.json().catch(() => ({}));
      lastError = new Error(err.error || `Chunk failed (${res.status})`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
    await new Promise((r) => setTimeout(r, Math.min(15_000, 500 * 2 ** attempt)));
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
  const chunkSize = Number(started.chunkSize) || 8 * 1024 * 1024;
  const uploadId = started.uploadId;
  const totalChunks = Math.max(1, Math.ceil((size || 1) / chunkSize));
  for (let i = 0; i < totalChunks; i++) {
    const slice = file.slice(i * chunkSize, Math.min(size, (i + 1) * chunkSize));
    await putChunk(chunkPath(uploadId, i), slice);
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
