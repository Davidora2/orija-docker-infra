import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import {
  buildFolderPathMap,
  downloadDriveFile,
  exportMetaFor,
  listAllDriveFiles,
  sanitizePathSegment,
  type DriveItem,
} from "@/lib/drive";
import { assertWritableDir, uniqueFilePath } from "@/lib/fs-dest";

export type SaveResult = {
  destination: string;
  saved: number;
  failed: number;
  errors: Array<{ file: string; error: string }>;
};

async function resolveEntries(files: DriveItem[]) {
  const pathMap = await buildFolderPathMap();
  const used = new Set<string>();

  return files.map((file) => {
    const parentId = file.parents?.[0];
    const folderPath = parentId ? pathMap.get(parentId) ?? "" : "";
    const exportInfo = exportMetaFor(file.mimeType);
    let name = sanitizePathSegment(file.name);
    if (exportInfo && !name.endsWith(exportInfo.extension)) {
      name = `${name}${exportInfo.extension}`;
    }
    const relative = folderPath
      ? `${folderPath.split("/").map(sanitizePathSegment).join("/")}/${name}`
      : name;
    return { file, relative: uniqueFilePath(relative, used) };
  });
}

export async function saveDriveFilesToDisk(options: {
  destinationPath: string;
  mode?: "all" | "selected";
  fileIds?: string[];
}): Promise<SaveResult> {
  const destination = await assertWritableDir(options.destinationPath);

  let files: DriveItem[];
  if (options.mode === "selected" && options.fileIds?.length) {
    const all = await listAllDriveFiles();
    const idSet = new Set(options.fileIds);
    files = all.filter((f) => idSet.has(f.id));
  } else {
    files = await listAllDriveFiles();
  }

  if (files.length === 0) {
    throw new Error("No files to export");
  }

  const entries = await resolveEntries(files);
  const errors: Array<{ file: string; error: string }> = [];
  let saved = 0;

  for (const { file, relative } of entries) {
    const target = path.join(destination, relative);
    try {
      await mkdir(path.dirname(target), { recursive: true });
      const { stream } = await downloadDriveFile(file.id, file.mimeType);
      await pipeline(stream as Readable, createWriteStream(target));
      saved += 1;
    } catch (err) {
      errors.push({
        file: relative,
        error: err instanceof Error ? err.message : "unknown error",
      });
    }
  }

  return {
    destination,
    saved,
    failed: errors.length,
    errors,
  };
}
