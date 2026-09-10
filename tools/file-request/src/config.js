import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadEnvFile() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

function parseFolders(raw) {
  const folders = [];
  for (const part of (raw || "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    folders.push({
      id: part.slice(0, eq).trim().toLowerCase().replace(/\s+/g, "-"),
      name: part.slice(0, eq).trim(),
      path: path.resolve(ROOT, part.slice(eq + 1).trim()),
    });
  }
  return folders;
}

const immichFolders = parseFolders(process.env.IMMICH_FOLDERS);
const dataRoot = path.resolve(ROOT, process.env.DATA_DIR || "./data");
const uploadRoot = path.resolve(ROOT, process.env.UPLOAD_ROOT || path.join(dataRoot, "uploads"));
const requestsFile = path.join(dataRoot, "requests.json");
const settingsFile = path.join(dataRoot, "settings.json");

for (const folder of immichFolders) {
  fs.mkdirSync(folder.path, { recursive: true });
}
fs.mkdirSync(uploadRoot, { recursive: true });
fs.mkdirSync(dataRoot, { recursive: true });
if (!fs.existsSync(requestsFile)) {
  fs.writeFileSync(requestsFile, "[]\n");
}
if (!fs.existsSync(settingsFile)) {
  fs.writeFileSync(settingsFile, `${JSON.stringify({ immichUrl: process.env.IMMICH_URL || "", users: [] }, null, 2)}\n`);
}

function mountPrefixFromBase(baseUrl) {
  try {
    const pathname = new URL(baseUrl).pathname.replace(/\/$/, "");
    return pathname && pathname !== "/" ? pathname : "";
  } catch {
    return "";
  }
}

const baseUrl = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3847}`).replace(/\/$/, "");

export const config = {
  root: ROOT,
  port: Number(process.env.PORT || 3847),
  baseUrl,
  mountPrefix: mountPrefixFromBase(baseUrl),
  adminPassword: process.env.ADMIN_PASSWORD || "",
  uploadRoot,
  requestsFile,
  settingsFile,
  immichFolders,
  unlimitedUploads: true,
  maxFileBytes: Number.MAX_SAFE_INTEGER,
  allowedMime: new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "image/gif",
    "image/tiff",
    "image/bmp",
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/webm",
  ]),
};
