'use strict';
(function () {
// Sons da interface, gerados na hora (sem arquivos de áudio). Só nas telas do app: durante o jogo o áudio local é
// fechado, para não sobrar nada rodando junto com ele.
let ctx = null;
let on = false;
let closeTimer = null;

function audio() {
  if (!on) return null;
  if (!ctx) { try { ctx = new AudioContext(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
function tone(a, { freq, to = freq, at = 0, dur, vol, type = 'sine', cut = 0 }) {
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let last = o;
  if (cut) {
    const f = a.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cut, t);
    f.frequency.exponentialRampToValueAtTime(cut * 5, t + dur);
    o.connect(f);
    last = f;
  }
  last.connect(g);
  g.connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}
const SOUNDS = {
  hover: (a) => tone(a, { freq: 1500, dur: 0.03, vol: 0.012 }),
  click: (a) => tone(a, { freq: 880, to: 660, dur: 0.07, vol: 0.05, type: 'triangle' }),
  select: (a) => { tone(a, { freq: 520, dur: 0.09, vol: 0.05, type: 'triangle' }); tone(a, { freq: 780, at: 0.07, dur: 0.12, vol: 0.05, type: 'triangle' }); },
  // START: um motor subindo o giro.
  start: (a) => { tone(a, { freq: 70, to: 420, dur: 0.75, vol: 0.09, type: 'sawtooth', cut: 500 }); tone(a, { freq: 140, to: 840, dur: 0.75, vol: 0.03, type: 'square', cut: 700 }); },
  intro: (a) => tone(a, { freq: 60, to: 240, dur: 0.9, vol: 0.06, type: 'sawtooth', cut: 320 }),
};
function play(name) { const a = audio(); if (a && SOUNDS[name]) { try { SOUNDS[name](a); } catch { /* sem som */ } } }
// Desligar espera o som do START terminar antes de fechar o áudio.
function setEnabled(v) {
  on = !!v;
  clearTimeout(closeTimer);
  if (!on && ctx) closeTimer = setTimeout(() => { if (!on && ctx) { ctx.close().catch(() => {}); ctx = null; } }, 1200);
}

// Um único ponto para todos os botões das telas do app.
let hovered = null;
function buttonOf(e) { const b = e.target && e.target.closest ? e.target.closest('button') : null; return b && !b.disabled ? b : null; }
function attach(doc) {
  doc.addEventListener('mouseover', (e) => {
    const b = buttonOf(e);
    if (b && b !== hovered) play('hover');
    hovered = b;
  }, true);
  doc.addEventListener('click', (e) => {
    const b = buttonOf(e);
    if (b) play(b.id === 'btn-start' ? 'start' : b.classList.contains('disc') ? 'select' : 'click');
  }, true);
}

const api = { play, setEnabled, attach, SOUNDS };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.Sounds = api;
})();
