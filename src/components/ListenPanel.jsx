export default function ListenPanel({
  listening,
  status,
  interim,
  transcriptLog,
  error,
  verseDetectionEnabled,
  captionEnabled,
  onToggleVerseDetection,
  onToggleCaptions,
  onStart,
  onStop,
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Audio listen</h2>
        <span className="status-dot" data-on={listening ? '1' : '0'} />
      </div>
      <p className="panel-copy">
        Point VerseCast at your sermon mic or loopback device. It hears spoken references
        like “John three sixteen” and pushes them to the OBS lower third.
      </p>

      <div className="btn-row">
        {!listening ? (
          <button type="button" className="btn primary" onClick={onStart}>
            Start listening
          </button>
        ) : (
          <button type="button" className="btn danger" onClick={onStop}>
            Stop
          </button>
        )}
        <span className="muted">{status === 'listening' ? 'Mic active' : 'Idle'}</span>
      </div>

      <div className="toggle-row">
        <label className="toggle">
          <input
            type="checkbox"
            checked={verseDetectionEnabled}
            onChange={(e) => onToggleVerseDetection(e.target.checked)}
          />
          Detect Bible verses
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={captionEnabled}
            onChange={(e) => onToggleCaptions(e.target.checked)}
          />
          Live captions
        </label>
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="interim-box" aria-live="polite">
        {interim || <span className="muted">Interim speech will appear here…</span>}
      </div>

      <div className="log">
        {transcriptLog.length === 0 && (
          <p className="muted">Final transcripts will collect here during the service.</p>
        )}
        {transcriptLog.map((item) => (
          <div key={item.at + item.text} className="log-item">
            {item.text}
          </div>
        ))}
      </div>
    </section>
  );
}
