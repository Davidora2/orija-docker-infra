import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";

export default function ShowDetailPage() {
  const { source, id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [seasonIdx, setSeasonIdx] = useState(0);
  const [error, setError] = useState("");
  const [favMsg, setFavMsg] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (source === "local") {
          const shows = await api("/library/shows");
          const match = (shows || []).find((s) => s.title === id || String(s.episodes?.[0]?.id) === id);
          if (!match) throw new Error("Show not found in local library");
          if (!alive) return;
          setItem({
            id,
            title: match.title,
            plot: "Local library",
            poster: "",
            source: "local",
            seasons: [
              {
                season: 1,
                episodes: match.episodes.map((ep) => ({
                  id: ep.id,
                  title: ep.title,
                  episode_num: ep.episode,
                  season: ep.season,
                  container: "mp4",
                })),
              },
            ],
          });
        } else {
          const data = await api(`/xtream/shows/${id}`);
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

  async function favorite() {
    try {
      await api("/favorites", {
        method: "POST",
        body: JSON.stringify({
          media_type: "show",
          source,
          external_id: id,
          title: item.title,
          poster: item.poster,
          year: item.year,
          save_to_library: true,
        }),
      });
      setFavMsg(source === "xtream" ? "Favorited — downloading to Shows folder…" : "Favorited");
    } catch (err) {
      setFavMsg(err.message);
    }
  }

  function playEpisode(ep) {
    navigate("/player", {
      state: {
        media_type: source === "local" ? "episode" : "show",
        source,
        external_id: source === "local" ? ep.id : id,
        episode_id: source === "local" ? undefined : ep.id,
        title: `${item.title} — ${ep.title}`,
        container: ep.container || "mp4",
        poster: item.poster,
      },
    });
  }

  if (error) return <p className="error">{error}</p>;
  if (!item) return <p className="muted">Loading…</p>;

  const season = item.seasons?.[seasonIdx];

  return (
    <div className="detail">
      <div className="detail-art" style={item.poster ? { backgroundImage: `url(${item.poster})` } : undefined} />
      <div>
        <h1>{item.title}</h1>
        <p className="muted">{[item.year, item.rating, source].filter(Boolean).join(" · ")}</p>
        <p style={{ maxWidth: 680, lineHeight: 1.55, marginTop: "1rem" }}>{item.plot || "No synopsis available."}</p>
        <div className="actions">
          {season?.episodes?.[0] && (
            <button className="btn" onClick={() => playEpisode(season.episodes[0])}>
              Play first episode
            </button>
          )}
          <button className="btn ghost" onClick={favorite}>
            ★ Favorite & Save
          </button>
          <button className="btn ghost" onClick={() => navigate(-1)}>
            Back
          </button>
        </div>
        {favMsg && <p className="muted">{favMsg}</p>}

        <div className="season-tabs">
          {(item.seasons || []).map((s, idx) => (
            <button key={s.season} className={idx === seasonIdx ? "active" : ""} onClick={() => setSeasonIdx(idx)}>
              Season {s.season}
            </button>
          ))}
        </div>

        <div className="panel">
          {(season?.episodes || []).map((ep) => (
            <div key={ep.id} className="episode">
              <div>
                <div style={{ fontWeight: 600 }}>
                  E{ep.episode_num ?? "?"} · {ep.title}
                </div>
                {ep.plot && <div className="muted" style={{ fontSize: "0.85rem" }}>{ep.plot}</div>}
              </div>
              <button className="btn ghost" onClick={() => playEpisode(ep)}>
                Play
              </button>
            </div>
          ))}
          {!season?.episodes?.length && <div className="empty">No episodes.</div>}
        </div>
      </div>
    </div>
  );
}
