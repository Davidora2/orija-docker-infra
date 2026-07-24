import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  deletePickerSession,
  fetchMediaBytes,
  listPickedMediaItems,
} from "@/lib/photos";
import { sanitizePathSegment } from "@/lib/drive";
import { assertWritableDir, uniqueFilePath } from "@/lib/fs-dest";

export type PhotosSaveResult = {
  destination: string;
  saved: number;
  failed: number;
  errors: Array<{ file: string; error: string }>;
};

export async function savePhotosToDisk(options: {
  sessionId: string;
  destinationPath: string;
}): Promise<PhotosSaveResult> {
  const destination = await assertWritableDir(options.destinationPath);
  const items = await listPickedMediaItems(options.sessionId);

  if (items.length === 0) {
    throw new Error("No photos selected");
  }

  const used = new Set<string>();
  const errors: Array<{ file: string; error: string }> = [];
  let saved = 0;

  for (const item of items) {
    const baseUrl = item.mediaFile?.baseUrl;
    if (!baseUrl) continue;

    const rawName =
      item.mediaFile?.filename ??
      `photo-${item.id}${item.mediaFile?.mimeType?.includes("video") ? ".mp4" : ".jpg"}`;
    const name = uniqueFilePath(sanitizePathSegment(rawName), used);
    const target = path.join(destination, name);

    try {
      await mkdir(path.dirname(target), { recursive: true });
      const bytes = await fetchMediaBytes(baseUrl, item.mediaFile?.mimeType);
      await writeFile(target, Buffer.from(bytes));
      saved += 1;
    } catch (err) {
      errors.push({
        file: name,
        error: err instanceof Error ? err.message : "unknown error",
      });
    }
  }

  try {
    await deletePickerSession(options.sessionId);
  } catch {
    // best-effort cleanup
  }

  return {
    destination,
    saved,
    failed: errors.length,
    errors,
  };
}
