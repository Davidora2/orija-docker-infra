"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import type { DriveItem } from "@/lib/drive";

function formatBytes(size?: string) {
  if (!size) return "—";
  const n = Number(size);
  if (!Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type Crumb = { id: string; name: string };

type DrivePanelProps = {
  destinationPath: string;
};

export function DrivePanel({ destinationPath }: DrivePanelProps) {
  const [files, setFiles] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: "root", name: "My Drive" }]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState<"all" | "selected" | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [folderId, setFolderId] = useState("root");

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const all: DriveItem[] = [];
      let pageToken: string | undefined;
      do {
        const params = new URLSearchParams({ folderId: id });
        if (pageToken) params.set("pageToken", pageToken);
        const res = await fetch(`/api/drive/files?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load Drive");
        all.push(...data.files);
        pageToken = data.nextPageToken;
      } while (pageToken);
      startTransition(() => {
        setFiles(all);
        setSelected(new Set());
        setLoading(false);
      });
    } catch (err) {
      startTransition(() => {
        setError(err instanceof Error ? err.message : "Failed to load Drive");
        setLoading(false);
      });
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(folderId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [folderId, load]);

  const selectableFiles = useMemo(
    () => files.filter((f) => !f.isFolder),
    [files],
  );

  function openFolder(item: DriveItem) {
    if (!item.isFolder) return;
    setCrumbs((prev) => [...prev, { id: item.id, name: item.name }]);
    setFolderId(item.id);
  }

  function jumpTo(index: number) {
    setCrumbs((prev) => {
      const next = prev.slice(0, index + 1);
      setFolderId(next[next.length - 1]?.id ?? "root");
      return next;
    });
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === selectableFiles.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(selectableFiles.map((f) => f.id)));
  }

  async function downloadOne(item: DriveItem) {
    setStatus(`Downloading ${item.name}…`);
    try {
      const params = new URLSearchParams({
        fileId: item.id,
        mimeType: item.mimeType,
      });
      const res = await fetch(`/api/drive/download?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.name;
      a.click();
      URL.revokeObjectURL(url);
      setStatus(`Downloaded ${item.name}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Download failed");
    }
  }

  async function saveToServer(mode: "all" | "selected") {
    if (!destinationPath) {
      setStatus("Choose a save location first.");
      return;
    }
    setExporting(mode);
    setStatus(
      mode === "all"
        ? `Saving entire Drive to ${destinationPath}… this can take a while.`
        : `Saving ${selected.size} file(s) to ${destinationPath}…`,
    );
    try {
      const res = await fetch("/api/drive/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          fileIds: mode === "selected" ? Array.from(selected) : undefined,
          destinationPath,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Export failed");
      }
      const failedNote =
        data.failed > 0 ? ` (${data.failed} failed — see server logs)` : "";
      setStatus(
        `Saved ${data.saved} file(s) to ${data.destination}${failedNote}`,
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Google Drive</h2>
          <p>Browse folders, then save files into your selected server folder.</p>
        </div>
        <div className="panel-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={selected.size === 0 || exporting !== null || !destinationPath}
            onClick={() => void saveToServer("selected")}
          >
            {exporting === "selected"
              ? "Saving…"
              : `Save selected (${selected.size})`}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={exporting !== null || !destinationPath}
            onClick={() => void saveToServer("all")}
          >
            {exporting === "all" ? "Saving…" : "Save all Drive files"}
          </button>
        </div>
      </div>

      <nav className="crumbs" aria-label="Folder path">
        {crumbs.map((crumb, index) => (
          <button
            key={`${crumb.id}-${index}`}
            type="button"
            className="crumb"
            onClick={() => jumpTo(index)}
          >
            {crumb.name}
          </button>
        ))}
      </nav>

      {status && <p className="status-line">{status}</p>}
      {error && <p className="error-line">{error}</p>}

      <div className="table-wrap">
        <table className="file-table">
          <thead>
            <tr>
              <th className="check-col">
                <input
                  type="checkbox"
                  aria-label="Select all files"
                  checked={
                    selectableFiles.length > 0 &&
                    selected.size === selectableFiles.length
                  }
                  onChange={toggleAll}
                />
              </th>
              <th>Name</th>
              <th>Modified</th>
              <th>Size</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="muted">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && files.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  This folder is empty.
                </td>
              </tr>
            )}
            {!loading &&
              files.map((item) => (
                <tr key={item.id}>
                  <td className="check-col">
                    {!item.isFolder && (
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggle(item.id)}
                        aria-label={`Select ${item.name}`}
                      />
                    )}
                  </td>
                  <td>
                    {item.isFolder ? (
                      <button
                        type="button"
                        className="folder-link"
                        onClick={() => openFolder(item)}
                      >
                        <span className="folder-mark" aria-hidden>
                          ▸
                        </span>
                        {item.name}
                      </button>
                    ) : (
                      <span className="file-name">{item.name}</span>
                    )}
                  </td>
                  <td>{formatDate(item.modifiedTime)}</td>
                  <td>{item.isFolder ? "—" : formatBytes(item.size)}</td>
                  <td>
                    {!item.isFolder && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => void downloadOne(item)}
                      >
                        Download
                      </button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
