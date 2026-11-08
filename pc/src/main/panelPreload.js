'use strict';
// Ponte mínima da janela flutuante (página local guide.html):
// fechar, recolher, transparência e tamanho (alça de redimensionar / ajuste automático do guia).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('panel', {
  close: () => ipcRenderer.send('panel:close'),
  dock: () => ipcRenderer.send('panel:dock'),
  setOpacity: (v) => ipcRenderer.send('panel:opacity', Number(v)),
  setSize: (width, height) => ipcRenderer.send('panel:size', { width: Number(width), height: Number(height) }),
  tips: () => ipcRenderer.send('panel:tips'), // volta à tela de Dicas do app
});
