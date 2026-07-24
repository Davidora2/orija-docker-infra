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

export function PhotosPanel() {
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
        setStatus(`${itemsData.items?.length ?? 0} item(s) ready to download.`);
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

  async function downloadZip() {
    if (!sessionId) return;
    setExporting(true);
    setStatus("Packing selected photos into a zip…");
    try {
      const res = await fetch("/api/photos/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="(.+)"/)?.[1] ?? "google-photos-export.zip";
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Photos export ready.");
      setSessionId(null);
      setPickerUri(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
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
        , then download the archive here alongside your Drive export.
      </div>

      {status && <p className="status-line">{status}</p>}
      {error && <p className="error-line">{error}</p>}

      {items.length > 0 && (
        <>
          <div className="panel-actions photos-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={exporting}
              onClick={() => void downloadZip()}
            >
              {exporting ? "Packing…" : `Download ${items.length} item(s) as zip`}
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
