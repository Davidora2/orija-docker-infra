import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import Poster from "../components/Poster";
import { useAuth } from "../hooks/useAuth";

export default function LibraryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [movies, setMovies] = useState([]);
  const [shows, setShows] = useState([]);
  const [paths, setPaths] = useState(null);
  const [scanInfo, setScanInfo] = useState(null);
  const [sortStatus, setSortStatus] = useState(null);
  const [sortPreview, setSortPreview] = useState(null);
  const [sortResult, setSortResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [m, s, p, st] = await Promise.all([
        api("/library?media_type=movies"),
        api("/library/shows"),
        api("/library/paths"),
        api("/sorter/status"),
      ]);
      setMovies(m || []);
      setShows(s || []);
      setPaths(p);
      setSortStatus(st);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function scan() {
    setBusy(true);
    try {
      const info = await api("/library/scan", { method: "POST" });
      setScanInfo(info);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function previewSort() {
    setBusy(true);
    setSortResult(null);
    try {
      const data = await api("/sorter/preview", {
        method: "POST",
        body: JSON.stringify({ apply_tmdb: true, include_library: false, fetch_artwork: true }),
      });
      setSortPreview(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function runSort() {
    setBusy(true);
    try {
      const data = await api("/sorter/run", {
        method: "POST",
        body: JSON.stringify({ apply_tmdb: true, include_library: false, fetch_artwork: true }),
      });
      setSortResult(data);
      setSortPreview(null);
      await api("/library/scan", { method: "POST" });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Local Library</h1>
          <p className="muted">
            {paths
              ? `${paths.movies} · ${paths.tvshows}`
              : "/srv/storage/data/media/movies · /srv/storage/data/media/TVshows"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button className="btn ghost" disabled={busy} onClick={scan}>
            {busy ? "Working…" : "Scan library"}
          </button>
        </div>
      </div>
      {scanInfo && (
        <p className="muted">
          Scanned {scanInfo.scanned} · added {scanInfo.added} · removed {scanInfo.removed}
        </p>
      )}
      {error && <p className="error">{error}</p>}

      {user?.is_admin && (
        <section className="section panel">
          <div className="section-head">
            <h2>Media Sorter</h2>
          </div>
          <p className="muted">
            Drop poorly named files into{" "}
            <code>{sortStatus?.incoming_dir || "…/incoming"}</code>. OrijaFlix renames them, moves them into{" "}
            <strong>movies</strong> or <strong>TVshows</strong>, and fetches cover art
            {sortStatus?.tmdb_enabled ? " via TMDB" : " (set TMDB_API_KEY for artwork + title correction)"}.
          </p>
          <p className="muted">Pending in inbox: {sortStatus?.pending_files ?? "—"}</p>
          <div className="actions">
            <button className="btn ghost" disabled={busy} onClick={previewSort}>
              Preview sort
            </button>
            <button className="btn" disabled={busy} onClick={runSort}>
              Run sorter
            </button>
          </div>
          {sortPreview && (
            <div style={{ marginTop: "1rem", maxHeight: 280, overflow: "auto" }}>
              <p className="muted">{sortPreview.count} planned actions</p>
              <table className="table">
                <thead>
                  <tr>
                    <th>From</th>
                    <th>Type</th>
                    <th>Title</th>
                    <th>To</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(sortPreview.items || []).slice(0, 50).map((item) => (
                    <tr key={item.source}>
                      <td style={{ fontSize: "0.8rem" }}>{item.source.split("/").pop()}</td>
                      <td>{item.media_type}</td>
                      <td>
                        {item.title}
                        {item.year ? ` (${item.year})` : ""}
                        {item.season != null ? ` S${String(item.season).padStart(2, "0")}E${String(item.episode).padStart(2, "0")}` : ""}
                      </td>
                      <td style={{ fontSize: "0.8rem" }}>{item.destination}</td>
                      <td>
                        <span className={`badge ${item.action === "move" ? "warn" : "ok"}`}>{item.action}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {sortResult && (
            <p className="muted" style={{ marginTop: "0.75rem" }}>
              Moved {sortResult.moved} · skipped {sortResult.skipped} · posters {sortResult.posters}
              {sortResult.errors?.length ? ` · errors ${sortResult.errors.length}` : ""}
            </p>
          )}
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Movies</h2>
        </div>
        {movies.length ? (
          <div className="grid">
            {movies.map((m) => (
              <Poster
                key={m.id}
                item={{ ...m, id: String(m.id), source: "local", media_type: "movie" }}
                onClick={() => navigate(`/movies/local/${m.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="empty">No local movies. Drop files in incoming/ or favorite from Xtream.</div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>TV Shows</h2>
        </div>
        {shows.length ? (
          <div className="grid">
            {shows.map((s) => (
              <Poster
                key={s.title}
                item={{
                  title: s.title,
                  poster: s.poster,
                  source: "local",
                  media_type: "show",
                  year: `${s.episodes?.length || 0} eps`,
                }}
                onClick={() => navigate(`/shows/local/${encodeURIComponent(s.title)}`)}
              />
            ))}
          </div>
        ) : (
          <div className="empty">No local TV shows yet.</div>
        )}
      </section>
    </div>
  );
}
