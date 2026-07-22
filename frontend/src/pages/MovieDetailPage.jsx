import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";

export default function MovieDetailPage() {
  const { source, id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [error, setError] = useState("");
  const [favMsg, setFavMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (source === "local") {
          const local = await api(`/library/${id}`);
          if (!alive) return;
          setItem({
            id: String(local.id),
            title: local.title,
            plot: "Local file",
            poster: "",
            year: "",
            container: "mp4",
            source: "local",
            media_type: "movie",
            path: local.path,
          });
        } else {
          const data = await api(`/xtream/movies/${id}`);
          if (!alive) return;
          setItem(data);
        }
      } catch (err) {
        if (alive) setError(err.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [source, id]);

  async function play() {
    navigate("/player", {
      state: {
        media_type: "movie",
        source,
        external_id: id,
        title: item.title,
        container: item.container || "mp4",
        poster: item.poster,
      },
    });
  }

  async function favorite() {
    setBusy(true);
    setFavMsg("");
    try {
      await api("/favorites", {
        method: "POST",
        body: JSON.stringify({
          media_type: "movie",
          source,
          external_id: id,
          title: item.title,
          poster: item.poster,
          year: item.year,
          save_to_library: true,
        }),
      });
      setFavMsg(source === "xtream" ? "Favorited — saving to Movies folder…" : "Favorited");
    } catch (err) {
      setFavMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!item) return <p className="muted">Loading…</p>;

  return (
    <div className="detail">
      <div
        className="detail-art"
        style={item.poster ? { backgroundImage: `url(${item.poster})` } : undefined}
      />
      <div>
        <h1>{item.title}</h1>
        <p className="muted">
          {[item.year, item.rating, item.duration, source].filter(Boolean).join(" · ")}
        </p>
        <p style={{ maxWidth: 640, lineHeight: 1.55, marginTop: "1rem" }}>{item.plot || "No synopsis available."}</p>
        <div className="actions">
          <button className="btn" onClick={play}>
            Play
          </button>
          <button className="btn ghost" disabled={busy} onClick={favorite}>
            ★ Favorite & Save
          </button>
          <button className="btn ghost" onClick={() => navigate(-1)}>
            Back
          </button>
        </div>
        {favMsg && <p className="muted">{favMsg}</p>}
      </div>
    </div>
  );
}
