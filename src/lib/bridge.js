const api = typeof window !== 'undefined' ? window.versecast : null;

const webFallback = {
  settings: null,
  verse: null,
  captions: '',
  listeners: new Set(),
};

async function ensureWebServerHint() {
  // When running in browser-only mode (npm run dev:web), talk to overlay server if present
  try {
    const res = await fetch('http://127.0.0.1:47821/api/state');
    if (res.ok) return true;
  } catch {
    /* offline */
  }
  return false;
}

export async function getSettings() {
  if (api) return api.getSettings();
  if (!webFallback.settings) {
    webFallback.settings = {
      theme: {
        lowerThird: {
          backgroundType: 'gradient',
          backgroundColor: '#0c1a24',
          backgroundColor2: '#1a3a4a',
          backgroundImage: '',
          textColor: '#f5f0e8',
          accentColor: '#c9a227',
          referenceColor: '#c9a227',
          fontFamily: 'Cormorant Garamond',
          referenceFontFamily: 'DM Sans',
          fontSize: 28,
          referenceFontSize: 16,
          paddingX: 36,
          paddingY: 20,
          borderRadius: 0,
          showAccentBar: true,
          accentBarPosition: 'left',
          position: 'bottom-left',
          maxWidth: 720,
          shadow: true,
          animation: 'slide-up',
          opacity: 0.96,
        },
        captions: {
          backgroundColor: 'rgba(0, 0, 0, 0.72)',
          textColor: '#ffffff',
          fontFamily: 'DM Sans',
          fontSize: 26,
          position: 'bottom',
          maxWidth: 900,
          paddingX: 24,
          paddingY: 14,
          borderRadius: 8,
          shadow: true,
          lines: 2,
        },
      },
      bibleTranslation: 'WEB',
      autoHideVerseMs: 12000,
      captionEnabled: true,
      verseDetectionEnabled: true,
      overlayPort: 47821,
    };
  }
  return structuredClone(webFallback.settings);
}

export async function saveSettings(settings) {
  if (api) return api.saveSettings(settings);
  webFallback.settings = settings;
  try {
    await fetch('http://127.0.0.1:47821/api/state');
  } catch {
    /* ignore */
  }
  return true;
}

export async function getOverlayInfo() {
  if (api) return api.getOverlayInfo();
  const online = await ensureWebServerHint();
  const port = 47821;
  return {
    port: online ? port : port,
    lowerThirdUrl: `http://127.0.0.1:${port}/lower-third`,
    captionsUrl: `http://127.0.0.1:${port}/captions`,
    previewUrl: `http://127.0.0.1:${port}/preview`,
  };
}

export async function showVerse(verse) {
  if (api) return api.showVerse(verse);
  webFallback.verse = verse;
  return true;
}

export async function hideVerse() {
  if (api) return api.hideVerse();
  webFallback.verse = null;
  return true;
}

export async function updateCaptions(text) {
  if (api) return api.updateCaptions(text);
  webFallback.captions = text;
  return true;
}

export async function clearCaptions() {
  if (api) return api.clearCaptions();
  webFallback.captions = '';
  return true;
}

export async function lookupVerse(reference) {
  if (api) return api.lookupVerse(reference);
  try {
    const res = await fetch(`http://127.0.0.1:47821/api/verse?ref=${encodeURIComponent(reference)}`);
    return await res.json();
  } catch {
    return null;
  }
}

export async function searchVerses(query) {
  if (api) return api.searchVerses(query);
  return [];
}

export async function getBibleBooks() {
  if (api) return api.getBibleBooks();
  return [];
}

export async function pickImage() {
  if (api) return api.pickImage();
  return null;
}

export async function getPlatform() {
  if (api) return api.getPlatform();
  return 'web';
}

export function isElectron() {
  return Boolean(api);
}
