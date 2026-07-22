import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import Poster from "../components/Poster";

export default function FavoritesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      setItems(await api("/favorites"));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  async function remove(id) {
    await api(`/favorites/${id}`, { method: "DELETE" });
    await load();
  }

  async function redownload(id) {
    await api(`/favorites/${id}/download`, { method: "POST" });
    await load();
  }

  function open(item) {
    const path = item.media_type === "show" ? "shows" : item.media_type === "live" ? "live" : "movies";
    if (path === "live") {
      navigate("/live");
      return;
    }
    navigate(`/${path}/${item.source}/${item.external_id}`);
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Favorites</h1>
          <p className="muted">Personalized per account. Xtream favorites download into Movies/Shows folders.</p>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {!items.length ? (
        <div className="empty">No favorites yet. Star titles while browsing.</div>
      ) : (
        <div className="grid">
          {items.map((item) => (
            <div key={item.id}>
              <Poster item={{ ...item, id: item.external_id }} onClick={() => open(item)} />
              <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
                <span
                  className={`badge ${
                    item.download_status === "done" ? "ok" : item.download_status === "error" ? "err" : "warn"
                  }`}
                >
                  {item.download_status}
                </span>
                {item.source === "xtream" && item.media_type !== "live" && (
                  <button className="btn ghost" style={{ padding: "0.25rem 0.55rem", fontSize: "0.78rem" }} onClick={() => redownload(item.id)}>
                    Save again
                  </button>
                )}
                <button className="btn ghost" style={{ padding: "0.25rem 0.55rem", fontSize: "0.78rem" }} onClick={() => remove(item.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
