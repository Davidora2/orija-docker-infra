"use client";

import { useEffect, useRef, useState } from "react";

type PickedItem = {
  id: string;
  mediaFile?: {
    filename?: string;
    mimeType?: string;
    baseUrl?: string;
  };
};

type PhotosPanelProps = {
  destinationPath: string;
};

export function PhotosPanel({ destinationPath }: PhotosPanelProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pickerUri, setPickerUri] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [items, setItems] = useState<PickedItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  async function startPicker() {
    setError(null);
    setItems([]);
    setStatus("Opening Google Photos picker…");
    try {
      const res = await fetch("/api/photos/session", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start Photos picker");

      setSessionId(data.id);
      const uri = `${data.pickerUri}/autoclose`;
      setPickerUri(uri);
      window.open(uri, "_blank", "noopener,noreferrer,width=960,height=720");
      setPolling(true);
      setStatus("Select photos in the Google Photos window, then return here.");

      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = window.setInterval(() => {
        void checkSession(data.id);
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start picker");
      setStatus(null);
    }
  }

  async function checkSession(id: string) {
    try {
      const res = await fetch(`/api/photos/session?sessionId=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Polling failed");

      if (data.mediaItemsSet) {
        if (pollRef.current) {
          window.clearInterval(pollRef.current);
          pollRef.current = null;
        }
        setPolling(false);
        setStatus("Selection complete. Loading items…");
        const itemsRes = await fetch(
          `/api/photos/items?sessionId=${encodeURIComponent(id)}`,
        );
        const itemsData = await itemsRes.json();
        if (!itemsRes.ok) throw new Error(itemsData.error ?? "Failed to list photos");
        setItems(itemsData.items ?? []);
        setStatus(`${itemsData.items?.length ?? 0} item(s) ready to save.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Polling failed");
      setPolling(false);
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }

  async function saveToServer() {
    if (!sessionId) return;
    if (!destinationPath) {
      setError("Choose a save location first.");
      return;
    }
    setExporting(true);
    setError(null);
    setStatus(`Saving selected photos to ${destinationPath}…`);
    try {
      const res = await fetch("/api/photos/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, destinationPath }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Save failed");
      }
      const failedNote =
        data.failed > 0 ? ` (${data.failed} failed)` : "";
      setStatus(`Saved ${data.saved} item(s) to ${data.destination}${failedNote}`);
      setSessionId(null);
      setPickerUri(null);
      setItems([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Google Photos</h2>
          <p>
            Google no longer allows apps to auto-read your full photo library.
            Pick batches here, or use Takeout for everything.
          </p>
        </div>
        <div className="panel-actions">
          {pickerUri && (
            <a className="btn btn-secondary" href={pickerUri} target="_blank" rel="noreferrer">
              Reopen picker
            </a>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={polling || exporting}
            onClick={() => void startPicker()}
          >
            {polling ? "Waiting for selection…" : "Pick photos to export"}
          </button>
        </div>
      </div>

      <div className="notice">
        <strong>Full library tip:</strong> For a complete Google Photos dump, use{" "}
        <a
          href="https://takeout.google.com/"
          target="_blank"
          rel="noreferrer"
        >
          Google Takeout
        </a>
        , then place the archive in your chosen server folder alongside Drive
        exports.
      </div>

      {status && <p className="status-line">{status}</p>}
      {error && <p className="error-line">{error}</p>}

      {items.length > 0 && (
        <>
          <div className="panel-actions photos-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={exporting || !destinationPath}
              onClick={() => void saveToServer()}
            >
              {exporting
                ? "Saving…"
                : `Save ${items.length} item(s) to server`}
            </button>
          </div>
          <ul className="photo-list">
            {items.map((item) => (
              <li key={item.id}>
                <span>{item.mediaFile?.filename ?? item.id}</span>
                <span className="muted">{item.mediaFile?.mimeType ?? ""}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
