import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import Poster from "../components/Poster";

export default function HomePage() {
  const navigate = useNavigate();
  const [movies, setMovies] = useState([]);
  const [shows, setShows] = useState([]);
  const [continueWatching, setContinue] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [st, prog, favs] = await Promise.all([
          api("/xtream/status"),
          api("/progress"),
          api("/favorites"),
        ]);
        if (!alive) return;
        setStatus(st);
        setContinue(prog || []);
        setFavorites((favs || []).slice(0, 12));

        if (st?.connected) {
          const [m, s] = await Promise.all([
            api("/xtream/catalog/movies?limit=18"),
            api("/xtream/catalog/shows?limit=18"),
          ]);
          if (!alive) return;
          setMovies(m.items || []);
          setShows(s.items || []);
        } else {
          const local = await api("/library?media_type=movies");
          if (!alive) return;
          setMovies((local || []).map((x) => ({ ...x, source: "local", media_type: "movie", id: String(x.id) })));
        }
      } catch (err) {
        if (alive) setError(err.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function openItem(item) {
    if (item.media_type === "show" || item.media_type === "series") {
      navigate(`/shows/${item.source || "xtream"}/${item.id || item.external_id}`);
    } else if (item.media_type === "live") {
      navigate(`/live`);
    } else {
      navigate(`/movies/${item.source || "xtream"}/${item.id || item.external_id}`);
    }
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Now Showing</h1>
          <p className="muted">
            {status?.connected
              ? `Xtream connected · max ${status.max_connections || "?"} lines`
              : "Browse local library or connect Xtream in Settings"}
          </p>
        </div>
      </div>
      {error && <p className="error">{error}</p>}

      {continueWatching.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Continue Watching</h2>
          </div>
          <div className="rail">
            {continueWatching.map((item) => (
              <Poster
                key={`${item.source}-${item.external_id}`}
                item={{ ...item, id: item.external_id }}
                onClick={() => openItem(item)}
              />
            ))}
          </div>
        </section>
      )}

      {favorites.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Your Favorites</h2>
          </div>
          <div className="rail">
            {favorites.map((item) => (
              <Poster
                key={item.id}
                item={{ ...item, id: item.external_id }}
                onClick={() => openItem(item)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Movies</h2>
          <button className="btn ghost" onClick={() => navigate("/movies")}>
            See all
          </button>
        </div>
        {movies.length ? (
          <div className="rail">
            {movies.map((item) => (
              <Poster key={`${item.source}-${item.id}`} item={item} onClick={() => openItem(item)} />
            ))}
          </div>
        ) : (
          <div className="empty">No movies yet. Connect Xtream or drop files into movies / incoming.</div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Shows</h2>
          <button className="btn ghost" onClick={() => navigate("/shows")}>
            See all
          </button>
        </div>
        {shows.length ? (
          <div className="rail">
            {shows.map((item) => (
              <Poster key={`${item.source}-${item.id}`} item={item} onClick={() => openItem(item)} />
            ))}
          </div>
        ) : (
          <div className="empty">No shows yet.</div>
        )}
      </section>
    </div>
  );
}
