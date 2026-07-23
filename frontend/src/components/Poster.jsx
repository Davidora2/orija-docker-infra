import React from "react";

export default function Poster({ item, onClick }) {
  const art = item.poster || item.cover || "";
  return (
    <div className="poster" onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onClick?.()}>
      <div
        className="poster-art"
        style={
          art
            ? { backgroundImage: `linear-gradient(160deg, rgba(7,16,24,0.1), rgba(7,16,24,0.35)), url(${art})` }
            : undefined
        }
      />
      <div className="poster-title">{item.title || item.name}</div>
      <div className="poster-meta">
        {[item.year, item.rating, item.source].filter(Boolean).join(" · ")}
      </div>
    </div>
  );
}
