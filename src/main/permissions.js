'use strict';
// Permissões que o site do jogo pode receber — lógica PURA (sem Electron), coberta por testes.
// Baseado no código aberto do port (github.com/th0mk/nfsu2-web):
//  - app/checks.ts chama navigator.storage.persist(): sem "persistent-storage" o navegador pode apagar
//    saves e os ~2 GB de dados do jogo quando o disco fica quase cheio.
//  - radio-folder.ts usa showDirectoryPicker({ mode: 'read' }) para a pasta de músicas da Rádio:
//    "fileSystem" é liberado SOMENTE para leitura (nunca escrita).
const ALWAYS = new Set(['fullscreen', 'pointerLock', 'keyboardLock', 'clipboard-sanitized-write', 'persistent-storage']);

function allowPermission(perm, details) {
  if (ALWAYS.has(perm)) return true;
  if (perm === 'fileSystem') return !!details && details.fileAccessType === 'readable';
  return false;
}

module.exports = { allowPermission, ALWAYS };
