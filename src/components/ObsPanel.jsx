import { useState } from 'react';

export default function ObsPanel({ overlayInfo, platform }) {
  const [copied, setCopied] = useState('');

  if (!overlayInfo) {
    return (
      <section className="panel">
        <p>Loading overlay URLs…</p>
      </section>
    );
  }

  const copy = async (label, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      setCopied('failed');
    }
  };

  const isMac = platform === 'darwin';
  const isWin = platform === 'win32';

  return (
    <div className="obs-layout">
      <section className="panel">
        <div className="panel-head">
          <h2>OBS Browser Sources</h2>
        </div>
        <p className="panel-copy">
          VerseCast runs a local overlay server. Add these URLs as Browser Sources in OBS Studio
          (or Streamlabs). Use a transparent background and match your canvas size (usually 1920×1080).
        </p>

        <UrlRow
          label="Lower third (verses)"
          url={overlayInfo.lowerThirdUrl}
          copied={copied === 'lower'}
          onCopy={() => copy('lower', overlayInfo.lowerThirdUrl)}
        />
        <UrlRow
          label="Captions"
          url={overlayInfo.captionsUrl}
          copied={copied === 'captions'}
          onCopy={() => copy('captions', overlayInfo.captionsUrl)}
        />
        <UrlRow
          label="Combined preview"
          url={overlayInfo.previewUrl}
          copied={copied === 'preview'}
          onCopy={() => copy('preview', overlayInfo.previewUrl)}
        />

        <ol className="steps">
          <li>Open OBS → Sources → + → Browser</li>
          <li>Paste a VerseCast URL above</li>
          <li>Width 1920 · Height 1080</li>
          <li>Check “Shutdown source when not visible” off so it stays connected</li>
          <li>Keep “Refresh browser when scene becomes active” optional</li>
        </ol>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Audio routing tips</h2>
        </div>
        {isMac && (
          <div className="tip-block">
            <h3>macOS</h3>
            <p>
              Grant microphone permission when prompted. To hear program audio (not just the mic),
              install a virtual device such as BlackHole, then select that input in VerseCast’s
              system mic picker / default input.
            </p>
          </div>
        )}
        {isWin && (
          <div className="tip-block">
            <h3>Windows</h3>
            <p>
              Enable “Stereo Mix” or use VB-Audio Cable to loop sermon audio into VerseCast.
              Set that device as the default recording device, or choose it when the browser
              permission prompt appears.
            </p>
          </div>
        )}
        {!isMac && !isWin && (
          <div className="tip-block">
            <p>
              On desktop installs for Windows and Mac, VerseCast uses the system speech engine
              with your selected microphone / loopback device.
            </p>
          </div>
        )}
        <div className="tip-block">
          <h3>Service workflow</h3>
          <p>
            Start listening before the message. Use manual verse entry as a backup for quiet
            references. Keep captions on a separate Browser Source so you can fade them independently.
          </p>
        </div>
      </section>
    </div>
  );
}

function UrlRow({ label, url, copied, onCopy }) {
  return (
    <div className="url-row">
      <div>
        <div className="url-label">{label}</div>
        <code>{url}</code>
      </div>
      <button type="button" className="btn ghost" onClick={onCopy}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
