'use strict';
// Zona do botão discreto: ele só aparece quando o cursor está perto do MEIO DO TOPO da janela.
// (O jogo limita o mouse e ele não alcança os cantos da tela, por isso não fica mais no canto.)
// No resto do tempo nada fica por cima do canvas do jogo, como numa aba do Chrome em tela cheia
// (uma camada por cima impede a apresentação direta do canvas e pode atrapalhar o ritmo dos quadros).
const ZONE = { w: 320, h: 90 };

/** cursor e bounds em DIP (screen.getCursorScreenPoint / win.getContentBounds) */
function inTopZone(cursor, bounds, zone = ZONE) {
  if (!cursor || !bounds) return false;
  const mid = bounds.x + bounds.width / 2;
  return cursor.x >= mid - zone.w / 2 && cursor.x <= mid + zone.w / 2 && cursor.y >= bounds.y && cursor.y <= bounds.y + zone.h;
}
module.exports = { inTopZone, ZONE };
