'use strict';
// "Recolher" da janela flutuante (guia) — lógica PURA, coberta por testes.
// Ao recolher, a janela some e fica um ponto invisível na borda do jogo mais próxima de onde ela estava.
// Passar o mouse nesse ponto reabre a janela. Enquanto recolhida, nada fica por cima do jogo.
const THICK = 18;   // espessura da faixa que pisca (px, na borda)
const LENGTH = 140; // comprimento ao longo da borda
const CORNER_GAP = 140; // o jogo não deixa o mouse ir aos cantos: o ponto fica longe deles
const REACH = 56;   // área de passar o mouse: vai além da faixa, para dentro da tela (o mouse pode não chegar à borda)

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** b = bounds da janela, area = área do jogo (DIP). Devolve { edge, rect, hover }. */
function dockSpot(b, area) {
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const dist = {
    left: b.x - area.x,
    right: area.x + area.width - (b.x + b.width),
    top: b.y - area.y,
    bottom: area.y + area.height - (b.y + b.height),
  };
  const edge = Object.keys(dist).reduce((a, k) => (dist[k] < dist[a] ? k : a), 'left');
  // Ao longo da borda, longe dos cantos (se o monitor for pequeno demais para isso, fica no meio da borda).
  const along = (c, start, size, len) => {
    const lo = start + CORNER_GAP;
    const hi = start + size - len - CORNER_GAP;
    return Math.round(lo <= hi ? clamp(c - len / 2, lo, hi) : start + (size - len) / 2);
  };
  if (edge === 'left' || edge === 'right') {
    const len = Math.min(LENGTH, area.height);
    const y = along(cy, area.y, area.height, len);
    const x = edge === 'left' ? area.x : area.x + area.width - THICK;
    return { edge, rect: { x, y, width: THICK, height: len }, hover: reach(edge, { x, y, width: THICK, height: len }) };
  }
  const len = Math.min(LENGTH, area.width);
  const x = along(cx, area.x, area.width, len);
  const y = edge === 'top' ? area.y : area.y + area.height - THICK;
  return { edge, rect: { x, y, width: len, height: THICK }, hover: reach(edge, { x, y, width: len, height: THICK }) };
}
// Área de "passar o mouse": a faixa mais REACH px para dentro da tela.
function reach(edge, r) {
  if (edge === 'left') return { ...r, width: r.width + REACH };
  if (edge === 'right') return { ...r, x: r.x - REACH, width: r.width + REACH };
  if (edge === 'top') return { ...r, height: r.height + REACH };
  return { ...r, y: r.y - REACH, height: r.height + REACH };
}

function inRect(p, r, pad = 0) {
  return !!p && !!r && p.x >= r.x - pad && p.x < r.x + r.width + pad && p.y >= r.y - pad && p.y < r.y + r.height + pad;
}

// Mover: a janela inteira fica dentro de `area` (a área do jogo). Não coube: encolhe; passou da borda: encosta nela.
function fitInside(b, area) {
  const width = Math.min(b.width, area.width);
  const height = Math.min(b.height, area.height);
  return {
    x: clamp(b.x, area.x, area.x + area.width - width),
    y: clamp(b.y, area.y, area.y + area.height - height),
    width,
    height,
  };
}
// Redimensionar pelas bordas: corta só o que passou de `area`, sem empurrar o lado oposto.
function clipInside(b, area) {
  const x = Math.max(b.x, area.x);
  const y = Math.max(b.y, area.y);
  return {
    x,
    y,
    width: Math.min(b.x + b.width, area.x + area.width) - x,
    height: Math.min(b.y + b.height, area.y + area.height) - y,
  };
}

module.exports = { dockSpot, inRect, fitInside, clipInside, THICK, LENGTH, CORNER_GAP, REACH };
