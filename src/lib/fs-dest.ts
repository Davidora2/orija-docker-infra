import { mkdir, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";

const DEFAULT_ROOTS = [
  path.join(/*turbopackIgnore: true*/ process.cwd(), "exports"),
  "/home/ubuntu",
];

export function getExportRoots(): string[] {
  const fromEnv = process.env.EXPORT_ROOTS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv?.length ? fromEnv : DEFAULT_ROOTS;
}

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

export async function ensureExportRoots(): Promise<string[]> {
  const roots = getExportRoots();
  const existing: string[] = [];
  for (const root of roots) {
    try {
      await ensureDir(root);
      const resolved = await realpath(root);
      existing.push(resolved);
    } catch {
      // skip roots we cannot create/access
    }
  }
  if (existing.length === 0) {
    throw new Error("No writable export roots configured");
  }
  return existing;
}

function isPathInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export async function resolveAllowedPath(inputPath: string): Promise<string> {
  if (!inputPath || typeof inputPath !== "string") {
    throw new Error("Destination path is required");
  }

  const roots = await ensureExportRoots();
  const absolute = path.resolve(inputPath);

  // Resolve as far as existing parents allow, then append remainder
  let probe = absolute;
  const missing: string[] = [];
  while (true) {
    try {
      const resolved = await realpath(probe);
      const remainder = missing.length
        ? path.join(resolved, ...missing.reverse())
        : resolved;

      const allowed = roots.some((root) => isPathInside(root, remainder));
      if (!allowed) {
        throw new Error(
          `Path must be under an allowed export root: ${roots.join(", ")}`,
        );
      }
      return remainder;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        missing.push(path.basename(probe));
        const parent = path.dirname(probe);
        if (parent === probe) {
          throw new Error("Invalid destination path");
        }
        probe = parent;
        continue;
      }
      throw err;
    }
  }
}

export async function assertWritableDir(dest: string): Promise<string> {
  const resolved = await resolveAllowedPath(dest);
  await ensureDir(resolved);
  const info = await stat(resolved);
  if (!info.isDirectory()) {
    throw new Error("Destination must be a directory");
  }
  return resolved;
}

export type FsEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
};

export async function listDirectory(dirPath?: string): Promise<{
  roots: string[];
  path: string;
  parent: string | null;
  entries: FsEntry[];
}> {
  const roots = await ensureExportRoots();

  if (!dirPath) {
    return {
      roots,
      path: "",
      parent: null,
      entries: roots.map((root) => ({
        name: root,
        path: root,
        isDirectory: true,
      })),
    };
  }

  const resolved = await assertWritableDir(dirPath);
  const parentDir = path.dirname(resolved);
  const parentAllowed = roots.some((root) => isPathInside(root, parentDir));
  const isRoot = roots.includes(resolved);

  const dirents = await readdir(resolved, { withFileTypes: true });
  const entries = dirents
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => ({
      name: d.name,
      path: path.join(resolved, d.name),
      isDirectory: true as const,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    roots,
    path: resolved,
    parent: isRoot ? null : parentAllowed ? parentDir : null,
    entries,
  };
}

export async function createSubfolder(
  parentPath: string,
  name: string,
): Promise<string> {
  const safe = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim();
  if (!safe || safe === "." || safe === "..") {
    throw new Error("Invalid folder name");
  }
  const parent = await assertWritableDir(parentPath);
  const target = await resolveAllowedPath(path.join(parent, safe));
  await ensureDir(target);
  return target;
}

export function uniqueFilePath(desired: string, used: Set<string>): string {
  if (!used.has(desired)) {
    used.add(desired);
    return desired;
  }
  const ext = path.extname(desired);
  const base = desired.slice(0, desired.length - ext.length);
  let i = 2;
  let candidate = `${base} (${i})${ext}`;
  while (used.has(candidate)) {
    i += 1;
    candidate = `${base} (${i})${ext}`;
  }
  used.add(candidate);
  return candidate;
}
