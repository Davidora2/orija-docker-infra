export default function CaptionsPanel({ captionText, onClear, enabled }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Captions</h2>
        <span className="muted">{enabled ? 'On air' : 'Disabled'}</span>
      </div>
      <p className="panel-copy">
        Streaming captions update live for accessibility. Add a separate OBS Browser Source
        pointed at the captions URL.
      </p>
      <div className="caption-preview">{captionText || <span className="muted">No caption text yet</span>}</div>
      <button type="button" className="btn ghost" onClick={onClear}>
        Clear captions
      </button>
    </section>
  );
}
