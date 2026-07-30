const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { startOverlayServer } = require('../server/overlayServer.cjs');

const isDev = !app.isPackaged;
let mainWindow = null;
let overlayServer = null;

function getDataPath(...parts) {
  if (isDev) {
    return path.join(__dirname, '..', 'data', ...parts);
  }
  return path.join(process.resourcesPath, 'data', ...parts);
}

function getOverlayPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'overlay');
  }
  return path.join(process.resourcesPath, 'overlay');
}

function getUserSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
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
    bibleTranslation: 'WEB',
    autoHideVerseMs: 12000,
    captionEnabled: true,
    verseDetectionEnabled: true,
    overlayPort: 47821,
  };

  try {
    const raw = JSON.parse(fs.readFileSync(getUserSettingsPath(), 'utf8'));
    return {
      ...defaults,
      ...raw,
      theme: {
        lowerThird: { ...defaults.theme.lowerThird, ...(raw.theme?.lowerThird || {}) },
        captions: { ...defaults.theme.captions, ...(raw.theme?.captions || {}) },
      },
    };
  } catch {
    return defaults;
  }
}

function saveSettings(settings) {
  fs.writeFileSync(getUserSettingsPath(), JSON.stringify(settings, null, 2), 'utf8');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    title: 'VerseCast',
    backgroundColor: '#0b1218',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  const settings = loadSettings();
  overlayServer = await startOverlayServer({
    port: settings.overlayPort,
    overlayDir: getOverlayPath(),
    biblePath: getDataPath('bible', 'web.json'),
    getSettings: () => loadSettings(),
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (overlayServer) overlayServer.close();
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('get-settings', () => loadSettings());

ipcMain.handle('save-settings', (_event, settings) => {
  saveSettings(settings);
  if (overlayServer) overlayServer.broadcast({ type: 'theme', payload: settings.theme });
  return true;
});

ipcMain.handle('get-overlay-info', () => {
  const settings = loadSettings();
  const port = overlayServer?.port || settings.overlayPort;
  return {
    port,
    lowerThirdUrl: `http://127.0.0.1:${port}/lower-third`,
    captionsUrl: `http://127.0.0.1:${port}/captions`,
    previewUrl: `http://127.0.0.1:${port}/preview`,
  };
});

ipcMain.handle('show-verse', (_event, verse) => {
  if (overlayServer) {
    overlayServer.broadcast({ type: 'verse', payload: verse });
    overlayServer.setCurrentVerse(verse);
  }
  return true;
});

ipcMain.handle('hide-verse', () => {
  if (overlayServer) {
    overlayServer.broadcast({ type: 'verse', payload: null });
    overlayServer.setCurrentVerse(null);
  }
  return true;
});

ipcMain.handle('update-captions', (_event, text) => {
  if (overlayServer) {
    overlayServer.broadcast({ type: 'captions', payload: text });
    overlayServer.setCaptions(text);
  }
  return true;
});

ipcMain.handle('clear-captions', () => {
  if (overlayServer) {
    overlayServer.broadcast({ type: 'captions', payload: '' });
    overlayServer.setCaptions('');
  }
  return true;
});

ipcMain.handle('lookup-verse', async (_event, reference) => {
  if (!overlayServer) return null;
  return overlayServer.lookupVerse(reference);
});

ipcMain.handle('search-verses', async (_event, query) => {
  if (!overlayServer) return [];
  return overlayServer.searchVerses(query);
});

ipcMain.handle('get-bible-books', () => {
  if (!overlayServer) return [];
  return overlayServer.getBooks();
});

ipcMain.handle('open-external', (_event, url) => {
  shell.openExternal(url);
});

ipcMain.handle('pick-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  const data = fs.readFileSync(filePath);
  return `data:image/${mime};base64,${data.toString('base64')}`;
});

ipcMain.handle('get-platform', () => process.platform);
