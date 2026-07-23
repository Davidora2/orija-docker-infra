import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";

export default function PlayerPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const sessionRef = useRef(null);
  const [error, setError] = useState("");
  const [sessionKey, setSessionKey] = useState(null);
  const [playUrl, setPlayUrl] = useState("");

  useEffect(() => {
    if (!state?.external_id) {
      setError("Nothing to play");
      return;
    }
    let cancelled = false;
    let heartbeatTimer;

    (async () => {
      try {
        const opened = await api("/streams/open", {
          method: "POST",
          body: JSON.stringify({
            media_type: state.media_type,
            source: state.source,
            external_id: String(state.external_id),
            title: state.title || "Stream",
            container: state.container || (state.media_type === "live" ? "ts" : "mp4"),
            episode_id: state.episode_id ? String(state.episode_id) : null,
          }),
        });
        if (cancelled) {
          // StrictMode remount — close the session we just opened
          api(`/streams/${opened.session_key}/close`, { method: "POST" }).catch(() => {});
          return;
        }
        sessionRef.current = opened.session_key;
        setSessionKey(opened.session_key);
        setPlayUrl(opened.play_url);
        setError("");

        heartbeatTimer = setInterval(() => {
          const key = sessionRef.current;
          if (key) api(`/streams/${key}/heartbeat`, { method: "POST" }).catch(() => {});
        }, 25000);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to open stream");
      }
    })();

    return () => {
      cancelled = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      const key = sessionRef.current;
      sessionRef.current = null;
      if (key) api(`/streams/${key}/close`, { method: "POST" }).catch(() => {});
    };
  }, [state]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playUrl || !state) return;

    const onError = () => {
      setError(
        "Playback failed. The stream URL may be wrong, blocked, or unsupported in this browser (try MP4/HLS). Press Back and Play again."
      );
    };

    const onTime = () => {
      if (!video.duration || !Number.isFinite(video.duration)) return;
      if (Math.floor(video.currentTime) % 10 !== 0) return;
      api("/progress", {
        method: "PUT",
        body: JSON.stringify({
          media_type: state.media_type,
          source: state.source,
          external_id: String(state.episode_id || state.external_id),
          title: state.title,
          poster: state.poster,
          position_seconds: Math.floor(video.currentTime),
          duration_seconds: Math.floor(video.duration),
        }),
      }).catch(() => {});
    };

    video.addEventListener("error", onError);
    video.addEventListener("timeupdate", onTime);
    return () => {
      video.removeEventListener("error", onError);
      video.removeEventListener("timeupdate", onTime);
    };
  }, [playUrl, state]);

  async function close() {
    const key = sessionRef.current || sessionKey;
    sessionRef.current = null;
    if (key) {
      try {
        await api(`/streams/${key}/close`, { method: "POST" });
      } catch {
        /* ignore */
      }
    }
    navigate(-1);
  }

  return (
    <div className="player-page">
      <div className="player-bar">
        <div>
          <strong>{state?.title || "Player"}</strong>
          {sessionKey && (
            <span className="muted" style={{ marginLeft: "0.75rem", fontSize: "0.85rem" }}>
              session {sessionKey.slice(0, 8)}…
            </span>
          )}
        </div>
        <button className="btn ghost" onClick={close}>
          Close
        </button>
      </div>
      {error ? (
        <div style={{ padding: "2rem" }}>
          <p className="error">{error}</p>
          <button className="btn" onClick={close}>
            Go back
          </button>
        </div>
      ) : playUrl ? (
        <video ref={videoRef} src={playUrl} controls autoPlay playsInline />
      ) : (
        <p className="muted" style={{ padding: "2rem" }}>
          Opening stream…
        </p>
      )}
    </div>
  );
}
