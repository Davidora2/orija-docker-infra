import { NextResponse } from "next/server";
import { ZipArchive } from "archiver";
import { PassThrough, Readable } from "node:stream";
import {
  deletePickerSession,
  fetchMediaBytes,
  listPickedMediaItems,
} from "@/lib/photos";
import { sanitizePathSegment } from "@/lib/drive";
import { savePhotosToDisk } from "@/lib/save-photos";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      destinationPath?: string;
      asZip?: boolean;
    };
    if (!body.sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    if (body.destinationPath && !body.asZip) {
      const result = await savePhotosToDisk({
        sessionId: body.sessionId,
        destinationPath: body.destinationPath,
      });
      return NextResponse.json(result);
    }

    const items = await listPickedMediaItems(body.sessionId);
    if (items.length === 0) {
      return NextResponse.json({ error: "No photos selected" }, { status: 400 });
    }

    const archive = new ZipArchive({ zlib: { level: 5 } });
    const passThrough = new PassThrough();
    archive.pipe(passThrough);

    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `google-photos-export-${stamp}.zip`;
    const used = new Set<string>();

    void (async () => {
      try {
        for (const item of items) {
          const baseUrl = item.mediaFile?.baseUrl;
          if (!baseUrl) continue;

          const rawName =
            item.mediaFile?.filename ??
            `photo-${item.id}${item.mediaFile?.mimeType?.includes("video") ? ".mp4" : ".jpg"}`;
          let name = sanitizePathSegment(rawName);
          if (used.has(name)) {
            const extIndex = name.lastIndexOf(".");
            const base = extIndex > 0 ? name.slice(0, extIndex) : name;
            const ext = extIndex > 0 ? name.slice(extIndex) : "";
            let i = 2;
            while (used.has(`${base} (${i})${ext}`)) i += 1;
            name = `${base} (${i})${ext}`;
          }
          used.add(name);

          try {
            const bytes = await fetchMediaBytes(baseUrl, item.mediaFile?.mimeType);
            archive.append(Buffer.from(bytes), { name });
          } catch (err) {
            const msg = err instanceof Error ? err.message : "unknown error";
            archive.append(`Failed to download: ${msg}\n`, {
              name: `${name}.ERROR.txt`,
            });
          }
        }
        await archive.finalize();
        try {
          await deletePickerSession(body.sessionId!);
        } catch {
          // session cleanup is best-effort
        }
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
