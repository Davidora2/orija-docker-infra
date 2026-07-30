import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearCaptions,
  getOverlayInfo,
  getPlatform,
  getSettings,
  hideVerse,
  isElectron,
  lookupVerse,
  saveSettings,
  showVerse,
  updateCaptions,
} from './lib/bridge';
import { findReferencesInText, formatReference } from './lib/verseDetector';
import { createCaptionBuffer, createSpeechSession } from './lib/speech';
import Header from './components/Header.jsx';
import ListenPanel from './components/ListenPanel.jsx';
import VersePanel from './components/VersePanel.jsx';
import CaptionsPanel from './components/CaptionsPanel.jsx';
import ThemePanel from './components/ThemePanel.jsx';
import ObsPanel from './components/ObsPanel.jsx';
import PreviewStage from './components/PreviewStage.jsx';

const TABS = [
  { id: 'live', label: 'Live' },
  { id: 'theme', label: 'Graphics' },
  { id: 'obs', label: 'OBS Setup' },
];

export default function App() {
  const [tab, setTab] = useState('live');
  const [settings, setSettings] = useState(null);
  const [overlayInfo, setOverlayInfo] = useState(null);
  const [platform, setPlatform] = useState('web');
  const [listening, setListening] = useState(false);
  const [listenStatus, setListenStatus] = useState('idle');
  const [transcriptLog, setTranscriptLog] = useState([]);
  const [interim, setInterim] = useState('');
  const [captionText, setCaptionText] = useState('');
  const [currentVerse, setCurrentVerse] = useState(null);
  const [detectedRefs, setDetectedRefs] = useState([]);
  const [manualRef, setManualRef] = useState('');
  const [error, setError] = useState('');
  const [saveFlash, setSaveFlash] = useState(false);

  const speechRef = useRef(null);
  const captionBufRef = useRef(null);
  const hideTimerRef = useRef(null);
  const lastVerseKeyRef = useRef('');
  const settingsRef = useRef(null);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    (async () => {
      const [s, info, p] = await Promise.all([getSettings(), getOverlayInfo(), getPlatform()]);
      setSettings(s);
      setOverlayInfo(info);
      setPlatform(p);
    })();
  }, []);

  const scheduleAutoHide = useCallback((ms) => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!ms || ms <= 0) return;
    hideTimerRef.current = setTimeout(async () => {
      await hideVerse();
      setCurrentVerse(null);
    }, ms);
  }, []);

  const displayVerse = useCallback(
    async (verse) => {
      if (!verse) return;
      const key = verse.reference;
      lastVerseKeyRef.current = key;
      setCurrentVerse(verse);
      await showVerse(verse);
      const ms = settingsRef.current?.autoHideVerseMs ?? 12000;
      scheduleAutoHide(ms);
    },
    [scheduleAutoHide]
  );

  const handleFinalTranscript = useCallback(
    async (text) => {
      setTranscriptLog((prev) => [{ text, at: Date.now() }, ...prev].slice(0, 40));
      setInterim('');

      const s = settingsRef.current;
      if (s?.captionEnabled) {
        captionBufRef.current?.push(text);
      }

      if (!s?.verseDetectionEnabled) return;

      const refs = findReferencesInText(text);
      if (!refs.length) return;

      setDetectedRefs((prev) => {
        const next = [...refs.map((r) => ({ ...r, at: Date.now() })), ...prev];
        const seen = new Set();
        return next
          .filter((r) => {
            const k = formatReference(r);
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          })
          .slice(0, 12);
      });

      const primary = refs[refs.length - 1];
      const lookupKey = formatReference(primary);
      if (lookupKey === lastVerseKeyRef.current) return;

      const verse = await lookupVerse(lookupKey);
      if (verse) await displayVerse(verse);
    },
    [displayVerse]
  );

  const startListening = useCallback(async () => {
    setError('');
    captionBufRef.current = createCaptionBuffer({
      maxChars: 160,
      onUpdate: async (text) => {
        setCaptionText(text);
        await updateCaptions(text);
      },
    });

    const session = createSpeechSession({
      onTranscript: handleFinalTranscript,
      onInterim: (text) => {
        setInterim(text);
        if (settingsRef.current?.captionEnabled) {
          captionBufRef.current?.setInterim(text);
        }
      },
      onError: (err) => setError(err.message || String(err)),
      onStatus: (status) => {
        setListenStatus(status);
        setListening(status === 'listening');
      },
    });

    if (!session) {
      setError('Speech recognition is unavailable. Use manual verse entry, or run in Electron.');
      return;
    }

    speechRef.current = session;
    session.start();
  }, [handleFinalTranscript]);

  const stopListening = useCallback(() => {
    speechRef.current?.stop();
    speechRef.current = null;
    setListening(false);
    setListenStatus('idle');
    setInterim('');
  }, []);

  useEffect(() => () => stopListening(), [stopListening]);

  const onManualShow = async () => {
    setError('');
    const verse = await lookupVerse(manualRef.trim());
    if (!verse) {
      setError(`Could not find “${manualRef.trim()}”. Try John 3:16 or Psalm 23:1.`);
      return;
    }
    await displayVerse(verse);
  };

  const onHideVerse = async () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    await hideVerse();
    setCurrentVerse(null);
    lastVerseKeyRef.current = '';
  };

  const onClearCaptions = async () => {
    captionBufRef.current?.clear();
    setCaptionText('');
    await clearCaptions();
  };

  const updateSettings = async (next) => {
    setSettings(next);
    await saveSettings(next);
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1200);
    const info = await getOverlayInfo();
    setOverlayInfo(info);
  };

  if (!settings) {
    return (
      <div className="app-loading">
        <div className="brand-mark">VerseCast</div>
        <p>Preparing your sanctuary overlays…</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header
        platform={platform}
        listening={listening}
        electron={isElectron()}
        saveFlash={saveFlash}
      />

      <nav className="tabs" aria-label="Primary">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'tab active' : 'tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {tab === 'live' && (
          <div className="live-layout">
            <div className="live-controls">
              <ListenPanel
                listening={listening}
                status={listenStatus}
                interim={interim}
                transcriptLog={transcriptLog}
                error={error}
                verseDetectionEnabled={settings.verseDetectionEnabled}
                captionEnabled={settings.captionEnabled}
                onToggleVerseDetection={(v) =>
                  updateSettings({ ...settings, verseDetectionEnabled: v })
                }
                onToggleCaptions={(v) => updateSettings({ ...settings, captionEnabled: v })}
                onStart={startListening}
                onStop={stopListening}
              />
              <VersePanel
                manualRef={manualRef}
                onManualRefChange={setManualRef}
                onShow={onManualShow}
                onHide={onHideVerse}
                currentVerse={currentVerse}
                detectedRefs={detectedRefs}
                autoHideVerseMs={settings.autoHideVerseMs}
                onAutoHideChange={(ms) => updateSettings({ ...settings, autoHideVerseMs: ms })}
                onPickDetected={async (ref) => {
                  const verse = await lookupVerse(formatReference(ref));
                  if (verse) await displayVerse(verse);
                }}
              />
              <CaptionsPanel
                captionText={captionText}
                onClear={onClearCaptions}
                enabled={settings.captionEnabled}
              />
            </div>
            <PreviewStage
              theme={settings.theme}
              verse={currentVerse}
              captions={captionText}
              overlayInfo={overlayInfo}
            />
          </div>
        )}

        {tab === 'theme' && (
          <ThemePanel settings={settings} onChange={updateSettings} />
        )}

        {tab === 'obs' && (
          <ObsPanel overlayInfo={overlayInfo} platform={platform} />
        )}
      </main>
    </div>
  );
}
