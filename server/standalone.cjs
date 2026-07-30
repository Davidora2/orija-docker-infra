#!/usr/bin/env node
/**
 * Standalone overlay server (no Electron UI) for OBS testing.
 * Usage: node server/standalone.cjs
 */
const path = require('path');
const { startOverlayServer } = require('./overlayServer.cjs');

const defaults = {
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
};

async function main() {
  const server = await startOverlayServer({
    port: Number(process.env.VERSECAST_PORT || 47821),
    overlayDir: path.join(__dirname, '..', 'overlay'),
    biblePath: path.join(__dirname, '..', 'data', 'bible', 'web.json'),
    getSettings: () => defaults,
  });

  console.log(`Lower third: http://127.0.0.1:${server.port}/lower-third`);
  console.log(`Captions:    http://127.0.0.1:${server.port}/captions`);
  console.log(`Preview:     http://127.0.0.1:${server.port}/preview`);

  // Demo verse after short delay for smoke tests
  if (process.env.VERSECAST_DEMO === '1') {
    setTimeout(() => {
      const verse = server.lookupVerse('John 3:16');
      if (verse) {
        server.setCurrentVerse(verse);
        server.broadcast({ type: 'verse', payload: verse });
        server.setCaptions('For God so loved the world…');
        server.broadcast({ type: 'captions', payload: 'For God so loved the world…' });
        console.log('Demo verse + captions broadcast');
      }
    }, 500);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
