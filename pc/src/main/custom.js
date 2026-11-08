'use strict';
// Personalização (lógica pura): fundo da tela inicial e capa (CD) de cada jogo, escolhidos pelo jogador.
// As imagens escolhidas são REFEITAS pelo app (redimensionadas e regravadas como JPG/PNG) em
// %APPDATA%\NFSU2 Launcher\custom\<jogo>-<tipo>.<ext>: o arquivo original nunca é usado direto.
const path = require('path');
const { GAME_IDS } = require('./config');

// bg: cabe em 2560×1440 (sem aumentar); disc: recorte quadrado do centro em 320×320 (a tela deixa redondo).
const KINDS = Object.freeze({
  bg: Object.freeze({ ext: 'jpg', maxW: 2560, maxH: 1440 }),
  disc: Object.freeze({ ext: 'png', size: 320 }),
});
const MAX_BYTES = 30 * 1024 * 1024; // imagem original até 30 MB
const EXTS = ['png', 'jpg', 'jpeg'];  // formatos que o Electron decodifica em qualquer PC

const valid = (gameId, kind) => GAME_IDS.includes(gameId) && Object.prototype.hasOwnProperty.call(KINDS, kind);
function fileFor(dir, gameId, kind) {
  return valid(gameId, kind) ? path.join(dir, `${gameId}-${kind}.${KINDS[kind].ext}`) : null;
}
// Tamanho final que cabe na caixa, mantendo a proporção e sem aumentar imagens pequenas.
function fitWithin(w, h, maxW, maxH) {
  const s = Math.min(1, maxW / w, maxH / h);
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
}
// Maior quadrado centralizado (a capa gira como um CD: precisa ser quadrada).
function squareCrop(w, h) {
  const side = Math.min(w, h);
  return { x: Math.floor((w - side) / 2), y: Math.floor((h - side) / 2), width: side, height: side };
}
const extOk = (file) => EXTS.includes(path.extname(String(file)).slice(1).toLowerCase());

module.exports = { KINDS, MAX_BYTES, EXTS, valid, fileFor, fitWithin, squareCrop, extOk };
