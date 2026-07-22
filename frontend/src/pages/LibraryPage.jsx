import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import Poster from "../components/Poster";

export default function LibraryPage() {
  const navigate = useNavigate();
  const [movies, setMovies] = useState([]);
  const [shows, setShows] = useState([]);
  const [scanInfo, setScanInfo] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [m, s] = await Promise.all([api("/library?media_type=movies"), api("/library/shows")]);
      setMovies(m || []);
      setShows(s || []);
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

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Local Library</h1>
          <p className="muted">Serves files from /media/movies and /media/shows</p>
        </div>
        <button className="btn" disabled={busy} onClick={scan}>
          {busy ? "Scanning…" : "Scan library"}
        </button>
      </div>
      {scanInfo && (
        <p className="muted">
          Scanned {scanInfo.scanned} · added {scanInfo.added} · removed {scanInfo.removed}
        </p>
      )}
      {error && <p className="error">{error}</p>}

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
          <div className="empty">No local movies. Favorites from Xtream save here automatically.</div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Shows</h2>
        </div>
        {shows.length ? (
          <div className="grid">
            {shows.map((s) => (
              <Poster
                key={s.title}
                item={{ title: s.title, source: "local", media_type: "show", year: `${s.episodes?.length || 0} eps` }}
                onClick={() => navigate(`/shows/local/${encodeURIComponent(s.title)}`)}
              />
            ))}
          </div>
        ) : (
          <div className="empty">No local shows yet.</div>
        )}
      </section>
    </div>
  );
}
