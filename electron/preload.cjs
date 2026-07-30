const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('versecast', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getOverlayInfo: () => ipcRenderer.invoke('get-overlay-info'),
  showVerse: (verse) => ipcRenderer.invoke('show-verse', verse),
  hideVerse: () => ipcRenderer.invoke('hide-verse'),
  updateCaptions: (text) => ipcRenderer.invoke('update-captions', text),
  clearCaptions: () => ipcRenderer.invoke('clear-captions'),
  lookupVerse: (reference) => ipcRenderer.invoke('lookup-verse', reference),
  searchVerses: (query) => ipcRenderer.invoke('search-verses', query),
  getBibleBooks: () => ipcRenderer.invoke('get-bible-books'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  pickImage: () => ipcRenderer.invoke('pick-image'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
});
