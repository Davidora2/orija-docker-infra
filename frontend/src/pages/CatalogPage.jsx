import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import Poster from "../components/Poster";

export default function CatalogPage({ kind }) {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const title = kind === "movies" ? "Movies" : kind === "shows" ? "Shows" : "Live TV";

  useEffect(() => {
    api(`/xtream/categories/${kind}`)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [kind]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams({ limit: "60" });
    if (categoryId) params.set("category_id", categoryId);
    if (q) params.set("q", q);
    api(`/xtream/catalog/${kind}?${params}`)
      .then((data) => {
        if (!alive) return;
        setItems(data.items || []);
        setTotal(data.total || 0);
        setError("");
      })
      .catch((err) => {
        if (alive) {
          setError(err.message);
          setItems([]);
        }
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [kind, categoryId, q]);

  function openItem(item) {
    if (kind === "live") {
      navigate(`/player`, {
        state: {
          media_type: "live",
          source: "xtream",
          external_id: item.id,
          title: item.title,
          container: "ts",
          poster: item.poster,
        },
      });
      return;
    }
    navigate(`/${kind}/${item.source}/${item.id}`);
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>{title}</h1>
          <p className="muted">{loading ? "Loading…" : `${total} titles`}</p>
        </div>
        <input
          className="search"
          placeholder={`Search ${title.toLowerCase()}…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {categories.length > 0 && (
        <div className="season-tabs" style={{ marginBottom: "1.25rem" }}>
          <button className={!categoryId ? "active" : ""} onClick={() => setCategoryId("")}>
            All
          </button>
          {categories.slice(0, 24).map((c) => (
            <button
              key={c.category_id}
              className={String(categoryId) === String(c.category_id) ? "active" : ""}
              onClick={() => setCategoryId(String(c.category_id))}
            >
              {c.category_name}
            </button>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {kind === "live" ? (
        <div className="panel">
          {items.map((item) => (
            <div key={item.id} className="live-row" onClick={() => openItem(item)}>
              <div className="live-icon" style={item.poster ? { backgroundImage: `url(${item.poster})` } : undefined} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{item.title}</div>
                <div className="muted" style={{ fontSize: "0.82rem" }}>
                  Live · Xtream
                </div>
              </div>
              <button className="btn">Watch</button>
            </div>
          ))}
          {!items.length && !loading && <div className="empty">No live channels found.</div>}
        </div>
      ) : (
        <div className="grid">
          {items.map((item) => (
            <Poster key={item.id} item={item} onClick={() => openItem(item)} />
          ))}
        </div>
      )}
      {!items.length && !loading && kind !== "live" && <div className="empty">No titles found.</div>}
    </div>
  );
}
