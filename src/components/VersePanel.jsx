import { formatReference } from '../lib/verseDetector';

export default function VersePanel({
  manualRef,
  onManualRefChange,
  onShow,
  onHide,
  currentVerse,
  detectedRefs,
  autoHideVerseMs,
  onAutoHideChange,
  onPickDetected,
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Verse lower third</h2>
      </div>

      <form
        className="verse-form"
        onSubmit={(e) => {
          e.preventDefault();
          onShow();
        }}
      >
        <label htmlFor="manual-ref">Manual reference</label>
        <div className="inline-fields">
          <input
            id="manual-ref"
            value={manualRef}
            onChange={(e) => onManualRefChange(e.target.value)}
            placeholder="John 3:16"
            autoComplete="off"
          />
          <button type="submit" className="btn primary">
            Show
          </button>
          <button type="button" className="btn ghost" onClick={onHide}>
            Hide
          </button>
        </div>
      </form>

      <label className="field-label" htmlFor="autohide">
        Auto-hide after {Math.round(autoHideVerseMs / 1000)}s
      </label>
      <input
        id="autohide"
        type="range"
        min="0"
        max="30000"
        step="1000"
        value={autoHideVerseMs}
        onChange={(e) => onAutoHideChange(Number(e.target.value))}
      />

      {currentVerse && (
        <div className="current-verse">
          <div className="current-ref">{currentVerse.reference}</div>
          <p>{currentVerse.text}</p>
        </div>
      )}

      {detectedRefs.length > 0 && (
        <div className="detected">
          <h3>Heard references</h3>
          <div className="chip-row">
            {detectedRefs.map((ref) => (
              <button
                key={formatReference(ref) + ref.at}
                type="button"
                className="chip"
                onClick={() => onPickDetected(ref)}
              >
                {formatReference(ref)}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
