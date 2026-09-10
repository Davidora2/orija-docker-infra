import express from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { nanoid } from "nanoid";
import { config } from "./config.js";
import * as store from "./store.js";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(config.root, "public")));

function requireAdmin(req, res, next) {
  if (!config.adminPassword) return next();
  const header = req.get("x-admin-password") || "";
  const query = req.query.password || "";
  const body = req.body?.password || "";
  if (header === config.adminPassword || query === config.adminPassword || body === config.adminPassword) {
    return next();
  }
  return res.status(401).json({ error: "Admin password required" });
}

function safeName(name) {
  return String(name || "upload")
    .replace(/[^\w.\- ()[\]]+/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 180);
}

const upload = multer({
  storage: multer.diskStorage({
    destination(req, _file, cb) {
      const dir = path.join(config.uploadRoot, req.params.id);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(_req, file, cb) {
      const base = safeName(file.originalname);
      cb(null, `${Date.now()}-${nanoid(6)}-${base}`);
    },
  }),
  limits: { fileSize: config.maxFileBytes, files: 50 },
  fileFilter(_req, file, cb) {
    if (config.allowedMime.has(file.mimetype) || /\.(jpe?g|png|webp|heic|heif|gif|tiff?|bmp|mp4|mov|avi|webm)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype || file.originalname}`));
    }
  },
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, folders: config.immichFolders.map((f) => f.name) });
});

app.get("/api/admin/config", requireAdmin, (_req, res) => {
  res.json({
    baseUrl: config.baseUrl,
    authRequired: Boolean(config.adminPassword),
    immichFolders: config.immichFolders.map(({ id, name, path: p }) => ({ id, name, path: p })),
    maxFileMb: config.maxFileBytes / (1024 * 1024),
  });
});

app.get("/api/admin/requests", requireAdmin, (_req, res) => {
  res.json(store.listRequests());
});

app.post("/api/admin/requests", requireAdmin, (req, res) => {
  const request = store.createRequest({
    title: req.body.title,
    description: req.body.description,
    createdBy: req.body.createdBy,
  });
  res.status(201).json({
    ...request,
    uploadUrl: `${config.baseUrl}/r/${request.id}`,
  });
});

app.post("/api/admin/requests/:id/close", requireAdmin, (req, res) => {
  const updated = store.setClosed(req.params.id, true);
  if (!updated) return res.status(404).json({ error: "Request not found" });
  res.json(updated);
});

app.post("/api/admin/requests/:id/reopen", requireAdmin, (req, res) => {
  const updated = store.setClosed(req.params.id, false);
  if (!updated) return res.status(404).json({ error: "Request not found" });
  res.json(updated);
});

app.get("/api/requests/:id", (req, res) => {
  const request = store.getRequest(req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found" });
  res.json({
    id: request.id,
    title: request.title,
    description: request.description,
    closed: request.closed,
    createdAt: request.createdAt,
    fileCount: request.files.length,
  });
});

app.post("/api/requests/:id/upload", (req, res) => {
  const request = store.getRequest(req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.closed) return res.status(403).json({ error: "This file request is closed" });

  upload.array("files", 50)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.files?.length) return res.status(400).json({ error: "No files uploaded" });
    const uploaderName = String(req.body.uploaderName || "Anonymous").trim() || "Anonymous";
    const note = String(req.body.note || "").trim();
    const saved = [];

    for (const file of req.files || []) {
      const meta = {
        id: nanoid(10),
        originalName: file.originalname,
        storedName: file.filename,
        size: file.size,
        mime: file.mimetype,
        uploaderName,
        note,
        uploadedAt: new Date().toISOString(),
        movedAt: null,
        destination: null,
      };
      store.addFile(request.id, meta);
      saved.push(meta);
    }

    res.status(201).json({ ok: true, count: saved.length, files: saved });
  });
});

app.post("/api/admin/move", requireAdmin, (req, res) => {
  const { requestId, fileIds, folderId, mode = "copy" } = req.body || {};
  const request = store.getRequest(requestId);
  if (!request) return res.status(404).json({ error: "Request not found" });

  const folder = config.immichFolders.find((f) => f.id === folderId);
  if (!folder) return res.status(400).json({ error: "Unknown Immich folder" });

  const ids = Array.isArray(fileIds) ? fileIds : [];
  if (!ids.length) return res.status(400).json({ error: "No files selected" });

  const results = [];
  for (const fileId of ids) {
    const file = request.files.find((f) => f.id === fileId);
    if (!file) {
      results.push({ fileId, ok: false, error: "File not found" });
      continue;
    }

    const src = path.join(config.uploadRoot, request.id, file.storedName);
    if (!fs.existsSync(src)) {
      results.push({ fileId, ok: false, error: "Source missing on disk" });
      continue;
    }

    const destName = safeName(file.originalName);
    let dest = path.join(folder.path, destName);
    if (fs.existsSync(dest)) {
      const ext = path.extname(destName);
      const stem = path.basename(destName, ext);
      dest = path.join(folder.path, `${stem}-${nanoid(4)}${ext}`);
    }

    try {
      if (mode === "move") fs.renameSync(src, dest);
      else fs.copyFileSync(src, dest);
      store.markFileMoved(requestId, fileId, { folderId: folder.id, folderName: folder.name, path: dest, mode });
      if (mode === "move") {
        // keep metadata but note file left staging
      }
      results.push({ fileId, ok: true, path: dest });
    } catch (error) {
      results.push({ fileId, ok: false, error: error.message });
    }
  }

  res.json({ ok: results.every((r) => r.ok), results });
});

app.get("/api/admin/files/:requestId/:fileId/preview", requireAdmin, (req, res) => {
  const request = store.getRequest(req.params.requestId);
  if (!request) return res.status(404).end();
  const file = request.files.find((f) => f.id === req.params.fileId);
  if (!file) return res.status(404).end();
  const src = path.join(config.uploadRoot, request.id, file.storedName);
  if (!fs.existsSync(src)) return res.status(404).end();
  res.type(file.mime || "application/octet-stream");
  fs.createReadStream(src).pipe(res);
});

app.get(["/", "/admin"], (_req, res) => {
  res.sendFile(path.join(config.root, "public", "admin.html"));
});

app.get("/r/:id", (_req, res) => {
  res.sendFile(path.join(config.root, "public", "request.html"));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Server error" });
});

app.listen(config.port, () => {
  console.log(`Immich File Request listening on ${config.baseUrl}`);
  console.log(`Admin: ${config.baseUrl}/admin`);
  console.log(
    `Immich folders: ${config.immichFolders.map((f) => `${f.name} → ${f.path}`).join(" | ") || "(none configured)"}`,
  );
});
