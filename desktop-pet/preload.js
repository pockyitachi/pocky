const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

contextBridge.exposeInMainWorld('petAPI', {
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
  quit: () => ipcRenderer.send('quit-app'),
  // 仓库根目录的性格档案，作为大脑人格的默认值
  readPersonality: () => {
    try {
      return fs.readFileSync(
        path.join(__dirname, '..', 'data', 'personality.md'),
        'utf8'
      );
    } catch (_) {
      return null;
    }
  },
});
