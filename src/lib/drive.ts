import type { drive_v3 } from "googleapis";
import { getDriveClient } from "@/lib/google";

export type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  parents?: string[];
  isFolder: boolean;
  iconLink?: string;
  thumbnailLink?: string;
};

const GOOGLE_EXPORT_MIME: Record<string, { mimeType: string; extension: string }> = {
  "application/vnd.google-apps.document": {
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: ".docx",
  },
  "application/vnd.google-apps.spreadsheet": {
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: ".xlsx",
  },
  "application/vnd.google-apps.presentation": {
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    extension: ".pptx",
  },
  "application/vnd.google-apps.drawing": {
    mimeType: "image/png",
    extension: ".png",
  },
};

function toDriveItem(file: drive_v3.Schema$File): DriveItem {
  return {
    id: file.id!,
    name: file.name ?? "Untitled",
    mimeType: file.mimeType ?? "application/octet-stream",
    size: file.size ?? undefined,
    modifiedTime: file.modifiedTime ?? undefined,
    parents: file.parents ?? undefined,
    isFolder: file.mimeType === "application/vnd.google-apps.folder",
    iconLink: file.iconLink ?? undefined,
    thumbnailLink: file.thumbnailLink ?? undefined,
  };
}

export async function listDriveChildren(folderId = "root", pageToken?: string) {
  const drive = await getDriveClient();
  const q = `'${folderId}' in parents and trashed = false`;

  const res = await drive.files.list({
    q,
    pageSize: 100,
    pageToken,
    fields:
      "nextPageToken, files(id, name, mimeType, size, modifiedTime, parents, iconLink, thumbnailLink)",
    orderBy: "folder,name_natural",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return {
    files: (res.data.files ?? []).map(toDriveItem),
    nextPageToken: res.data.nextPageToken ?? undefined,
  };
}

export async function listAllDriveFiles(): Promise<DriveItem[]> {
  const drive = await getDriveClient();
  const files: DriveItem[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: "trashed = false and mimeType != 'application/vnd.google-apps.folder'",
      pageSize: 1000,
      pageToken,
      fields:
        "nextPageToken, files(id, name, mimeType, size, modifiedTime, parents, iconLink, thumbnailLink)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    files.push(...(res.data.files ?? []).map(toDriveItem));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}

export async function buildFolderPathMap(): Promise<Map<string, string>> {
  const drive = await getDriveClient();
  const folders = new Map<string, { name: string; parents?: string[] }>();
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: "trashed = false and mimeType = 'application/vnd.google-apps.folder'",
      pageSize: 1000,
      pageToken,
      fields: "nextPageToken, files(id, name, parents)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const folder of res.data.files ?? []) {
      if (folder.id) {
        folders.set(folder.id, {
          name: folder.name ?? "Untitled",
          parents: folder.parents ?? undefined,
        });
      }
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  const pathCache = new Map<string, string>();

  function resolvePath(id: string, seen = new Set<string>()): string {
    if (pathCache.has(id)) return pathCache.get(id)!;
    if (seen.has(id)) return "";
    seen.add(id);
    const folder = folders.get(id);
    if (!folder) {
      pathCache.set(id, "");
      return "";
    }
    const parentId = folder.parents?.[0];
    const parentPath =
      parentId && parentId !== "root" ? resolvePath(parentId, seen) : "";
    const path = parentPath ? `${parentPath}/${folder.name}` : folder.name;
    pathCache.set(id, path);
    return path;
  }

  for (const id of folders.keys()) {
    resolvePath(id);
  }

  return pathCache;
}

export function exportMetaFor(mimeType: string) {
  return GOOGLE_EXPORT_MIME[mimeType];
}

export async function downloadDriveFile(
  fileId: string,
  mimeType: string,
): Promise<{ stream: NodeJS.ReadableStream; filename: string; contentType: string }> {
  const drive = await getDriveClient();
  const meta = await drive.files.get({
    fileId,
    fields: "id, name, mimeType",
    supportsAllDrives: true,
  });

  const name = meta.data.name ?? "file";
  const type = meta.data.mimeType ?? mimeType;
  const exportInfo = exportMetaFor(type);

  if (exportInfo) {
    const res = await drive.files.export(
      { fileId, mimeType: exportInfo.mimeType },
      { responseType: "stream" },
    );
    const filename = name.endsWith(exportInfo.extension)
      ? name
      : `${name}${exportInfo.extension}`;
    return {
      stream: res.data as NodeJS.ReadableStream,
      filename,
      contentType: exportInfo.mimeType,
    };
  }

  if (type.startsWith("application/vnd.google-apps.")) {
    throw new Error(`Unsupported Google Docs type: ${type}`);
  }

  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "stream" },
  );

  return {
    stream: res.data as NodeJS.ReadableStream,
    filename: name,
    contentType: type,
  };
}

export function sanitizePathSegment(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim() || "untitled";
}
