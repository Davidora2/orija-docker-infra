import { NextResponse } from "next/server";
import { ZipArchive } from "archiver";
import { PassThrough, Readable } from "node:stream";
import {
  buildFolderPathMap,
  downloadDriveFile,
  listAllDriveFiles,
  sanitizePathSegment,
  type DriveItem,
} from "@/lib/drive";

export const runtime = "nodejs";
export const maxDuration = 300;

function uniqueZipPath(used: Set<string>, desired: string): string {
  if (!used.has(desired)) {
    used.add(desired);
    return desired;
  }
  const extIndex = desired.lastIndexOf(".");
  const base = extIndex > 0 ? desired.slice(0, extIndex) : desired;
  const ext = extIndex > 0 ? desired.slice(extIndex) : "";
  let i = 2;
  let candidate = `${base} (${i})${ext}`;
  while (used.has(candidate)) {
    i += 1;
    candidate = `${base} (${i})${ext}`;
  }
  used.add(candidate);
  return candidate;
}

async function resolveZipEntries(files: DriveItem[]) {
  const pathMap = await buildFolderPathMap();
  const used = new Set<string>();
  return files.map((file) => {
    const parentId = file.parents?.[0];
    const folderPath = parentId ? pathMap.get(parentId) ?? "" : "";
    const safeName = sanitizePathSegment(file.name);
    const relative = folderPath
      ? `${folderPath.split("/").map(sanitizePathSegment).join("/")}/${safeName}`
      : safeName;
    return { file, zipPath: uniqueZipPath(used, relative) };
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      mode?: "all" | "selected";
      fileIds?: string[];
    };

    let files: DriveItem[];
    if (body.mode === "selected" && body.fileIds?.length) {
      const all = await listAllDriveFiles();
      const idSet = new Set(body.fileIds);
      files = all.filter((f) => idSet.has(f.id));
    } else {
      files = await listAllDriveFiles();
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "No files to export" }, { status: 400 });
    }

    const entries = await resolveZipEntries(files);
    const archive = new ZipArchive({ zlib: { level: 5 } });
    const passThrough = new PassThrough();
    archive.pipe(passThrough);

    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `google-drive-export-${stamp}.zip`;

    // Build zip asynchronously while streaming response
    void (async () => {
      try {
        for (const { file, zipPath } of entries) {
          try {
            const { stream } = await downloadDriveFile(file.id, file.mimeType);
            archive.append(stream as Readable, { name: zipPath });
          } catch (err) {
            const msg = err instanceof Error ? err.message : "unknown error";
            archive.append(`Failed to download: ${msg}\n`, {
              name: `${zipPath}.ERROR.txt`,
            });
          }
        }
        await archive.finalize();
      } catch (err) {
        passThrough.destroy(err instanceof Error ? err : new Error("Export failed"));
      }
    })();

    const webStream = Readable.toWeb(passThrough) as ReadableStream;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
