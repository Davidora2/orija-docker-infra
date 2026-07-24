"use client";

import { startTransition, useCallback, useEffect, useState } from "react";

type FsEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
};

type BrowseResponse = {
  roots: string[];
  path: string;
  parent: string | null;
  entries: FsEntry[];
  error?: string;
};

type DestinationPickerProps = {
  value: string;
  onChange: (path: string) => void;
};

export function DestinationPicker({ value, onChange }: DestinationPickerProps) {
  const [browsePath, setBrowsePath] = useState<string>("");
  const [parent, setParent] = useState<string | null>(null);
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [roots, setRoots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (path?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (path) params.set("path", path);
      const res = await fetch(`/api/fs/browse?${params}`);
      const data = (await res.json()) as BrowseResponse;
      if (!res.ok) throw new Error(data.error ?? "Could not browse folders");

      startTransition(() => {
        setRoots(data.roots);
        setBrowsePath(data.path);
        setParent(data.parent);
        setEntries(data.entries);
        setLoading(false);
      });

      if (!value) {
        if (data.path) {
          onChange(data.path);
        } else if (data.roots[0]) {
          onChange(data.roots[0]);
          // Dive into the default root so the user can pick immediately
          const rootRes = await fetch(
            `/api/fs/browse?${new URLSearchParams({ path: data.roots[0] })}`,
          );
          const rootData = (await rootRes.json()) as BrowseResponse;
          if (rootRes.ok) {
            startTransition(() => {
              setBrowsePath(rootData.path);
              setParent(rootData.parent);
              setEntries(rootData.entries);
            });
          }
        }
      }
    } catch (err) {
      startTransition(() => {
        setError(err instanceof Error ? err.message : "Browse failed");
        setLoading(false);
      });
    }
  }, [onChange, value]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(value || undefined);
    }, 0);
    return () => window.clearTimeout(timer);
    // initial load only; navigation calls load directly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openPath(next: string) {
    onChange(next);
    await load(next);
  }

  async function goUp() {
    if (parent) {
      await openPath(parent);
      return;
    }
    onChange("");
    await load(undefined);
  }

  async function createFolder() {
    if (!browsePath || !newFolder.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/fs/browse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentPath: browsePath, name: newFolder.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create folder");
      setNewFolder("");
      await openPath(data.path as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="panel destination-panel">
      <div className="panel-head">
        <div>
          <h2>Save location</h2>
          <p>Choose the server folder where exported files will be written.</p>
        </div>
      </div>

      <div className="destination-selected">
        <span className="muted">Selected</span>
        <code>{value || "No folder selected"}</code>
      </div>

      {error && <p className="error-line">{error}</p>}

      <div className="destination-toolbar">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={loading || (!parent && !browsePath)}
          onClick={() => void goUp()}
        >
          Up
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={loading || !browsePath}
          onClick={() => browsePath && onChange(browsePath)}
        >
          Use this folder
        </button>
        {!browsePath && roots.length > 0 && (
          <span className="muted">Pick an export root to begin</span>
        )}
      </div>

      <div className="table-wrap destination-list">
        {loading ? (
          <p className="muted pad">Loading folders…</p>
        ) : entries.length === 0 ? (
          <p className="muted pad">No subfolders here.</p>
        ) : (
          <ul className="folder-browser">
            {entries.map((entry) => (
              <li key={entry.path}>
                <button
                  type="button"
                  className={`folder-row ${value === entry.path ? "active" : ""}`}
                  onClick={() => void openPath(entry.path)}
                >
                  <span className="folder-mark" aria-hidden>
                    ▸
                  </span>
                  <span>{entry.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {browsePath && (
        <div className="create-folder">
          <input
            type="text"
            placeholder="New folder name"
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createFolder();
            }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={creating || !newFolder.trim()}
            onClick={() => void createFolder()}
          >
            {creating ? "Creating…" : "Create folder"}
          </button>
        </div>
      )}
    </section>
  );
}
