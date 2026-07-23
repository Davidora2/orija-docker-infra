import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import Poster from "../components/Poster";

export default function SearchPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [items, setItems] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const term = q.trim();
    setParams(term ? { q: term } : {});
    if (term.length < 1) {
      setItems([]);
      setSuggestions([]);
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
        setSuggestions(data.suggestions || []);
        setTotal(data.total || 0);
      } catch (err) {
        if (alive) {
          setError(err.message);
          setItems([]);
          setSuggestions([]);
          setTotal(0);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }, 220);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q]);

  function openItem(item) {
    if (item.kind === "prediction" && item.source === "tmdb") {
      // Use predicted title as the search query to find provider/library copies
      setQ(item.title);
      return;
    }
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
    if (!item.id || item.source === "tmdb") {
      setQ(item.title);
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
              ? "Recognizing titles…"
              : q.trim()
                ? `${total} match${total === 1 ? "" : "es"}`
                : "Fuzzy search + title predictions across Xtream & library"}
          </p>
        </div>
        <input
          className="search"
          placeholder="Try sho, shogun, matrix 99…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </div>

      {!!suggestions.length && (
        <div className="suggest-row">
          {suggestions.map((s) => (
            <button
              key={`${s.kind}-${s.source}-${s.id || s.tmdb_id || s.title}`}
              type="button"
              className={`suggest-chip ${s.kind === "prediction" ? "predict" : ""}`}
              onClick={() => openItem(s)}
            >
              <span className="suggest-title">{s.title}</span>
              <span className="suggest-meta">
                {[s.year, s.media_type, s.kind === "prediction" ? "predicted" : s.match].filter(Boolean).join(" · ")}
              </span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {!loading && q.trim() && !items.length && <div className="empty">No matches for “{q.trim()}”</div>}
      {!q.trim() && <div className="empty">Start typing — predictions appear as titles are recognized.</div>}
      {!!items.length && (
        <div className="grid">
          {items.map((item) => (
            <Poster
              key={`${item.source}-${item.media_type}-${item.id}`}
              item={{
                ...item,
                year: [item.year, item.match, item.origin || item.source, item.score ? `${item.score}` : null]
                  .filter(Boolean)
                  .join(" · "),
              }}
              onClick={() => openItem(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
