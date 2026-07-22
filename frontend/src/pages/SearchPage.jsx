import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import Poster from "../components/Poster";

export default function SearchPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const term = q.trim();
    setParams(term ? { q: term } : {});
    if (term.length < 1) {
      setItems([]);
      setTotal(0);
      return;
    }
    let alive = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api(`/search?q=${encodeURIComponent(term)}&limit=60`);
        if (!alive) return;
        setItems(data.items || []);
        setTotal(data.total || 0);
      } catch (err) {
        if (alive) {
          setError(err.message);
          setItems([]);
          setTotal(0);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }, 280);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q]);

  function openItem(item) {
    if (item.media_type === "live") {
      navigate("/player", {
        state: {
          media_type: "live",
          source: item.source || "xtream",
          external_id: item.id,
          title: item.title,
          container: "ts",
          poster: item.poster,
        },
      });
      return;
    }
    const kind = item.media_type === "show" ? "shows" : "movies";
    navigate(`/${kind}/${item.source || "xtream"}/${item.id}`);
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Search</h1>
          <p className="muted">
            {loading
              ? "Searching movies, shows, live & library…"
              : q.trim()
                ? `${total} match${total === 1 ? "" : "es"}`
                : "Search across Xtream + local library"}
          </p>
        </div>
        <input
          className="search"
          placeholder="Search Shogun, movies, channels…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </div>
      {error && <p className="error">{error}</p>}
      {!loading && q.trim() && !items.length && <div className="empty">No matches for “{q.trim()}”</div>}
      {!q.trim() && <div className="empty">Type a title to search everywhere.</div>}
      {!!items.length && (
        <div className="grid">
          {items.map((item) => (
            <Poster
              key={`${item.source}-${item.media_type}-${item.id}`}
              item={{
                ...item,
                year: [item.year, item.origin || item.source, item.media_type].filter(Boolean).join(" · "),
              }}
              onClick={() => openItem(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
