'use strict';
(function () {
// Normalização e validação de combinações de teclas (ex.: "Ctrl+Alt+Shift+P").
// Usado pelo processo principal (Node) e pela interface local (<script>).
const FKEYS = /^F([1-9]|1[0-9]|2[0-4])$/;
const NAMED = {
  Space: 'Space', Enter: 'Enter', NumpadEnter: 'Enter', Insert: 'Insert', Delete: 'Delete',
  Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
};
const ALLOWED_KEYS = new Set([
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''),
  ...Array.from({ length: 24 }, (_, i) => `F${i + 1}`),
  ...Object.values(NAMED),
]);
function keyName(code) {
  if (typeof code !== 'string') return null;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (FKEYS.test(code)) return code;
  return NAMED[code] || null;
}
function fromEvent(e) {
  const key = keyName(e && e.code);
  if (!key) return null;
  const parts = [];
  if (e.control || e.ctrlKey) parts.push('Ctrl');
  if (e.alt || e.altKey) parts.push('Alt');
  if (e.shift || e.shiftKey) parts.push('Shift');
  if (e.meta || e.metaKey) parts.push('Win');
  parts.push(key);
  return parts.join('+');
}
const RESERVED = new Set(['Ctrl+Alt+O', 'Ctrl+Alt+I', 'Ctrl+W', 'Ctrl+Alt+Delete', 'Alt+F4', 'Alt+Space', 'Alt+Tab', 'Alt+Esc']);
// Teclas do jogo. Ctrl e Shift trocam de marcha e Alt é o nitro, então Ctrl/Alt + uma dessas teclas acontece
// sem querer numa corrida (ex.: reduzir marcha + virar = Ctrl+D). Só valem com Ctrl+Alt+Shift juntos.
const GAME_KEYS = new Set(['W', 'A', 'S', 'D', 'Up', 'Down', 'Left', 'Right', 'Space', 'Enter',
  'C', 'B', 'R', 'H', 'J', 'N', 'X', 'M', 'P', '1', '2', '3', '4', 'F8', 'F9', 'F12']);
function validate(combo) {
  if (typeof combo !== 'string' || !combo) return { ok: false, reason: 'Combinação vazia.' };
  const parts = combo.split('+');
  const key = parts.pop();
  const mods = new Set(parts);
  if (!ALLOWED_KEYS.has(key)) return { ok: false, reason: 'Tecla não suportada.' };
  for (const m of mods) {
    if (!['Ctrl', 'Alt', 'Shift'].includes(m)) {
      return { ok: false, reason: 'Use apenas Ctrl, Alt e Shift (a tecla Windows é reservada pelo sistema).' };
    }
  }
  if (mods.size !== parts.length) return { ok: false, reason: 'Modificador repetido.' };
  if (!mods.has('Ctrl') && !mods.has('Alt')) {
    return { ok: false, reason: 'Inclua Ctrl ou Alt para evitar disparos acidentais durante o jogo.' };
  }
  const canon = ['Ctrl', 'Alt', 'Shift'].filter((m) => mods.has(m)).concat(key).join('+');
  if (canon !== combo) return { ok: false, reason: 'Formato inválido.' };
  if (RESERVED.has(canon)) return { ok: false, reason: 'Combinação reservada pelo Windows ou bloqueada pelo app.' };
  if (GAME_KEYS.has(key) && mods.size < 3) {
    return { ok: false, reason: `${key} é tecla do jogo: com Ctrl (marcha) ou Alt (nitro) ela dispara sem querer na corrida. Use uma tecla que o jogo não usa (F, G, K, L, Q, T, U, V, Y, Z, 5–0, F1–F7) ou Ctrl+Alt+Shift.` };
  }
  return { ok: true };
}
function toAccelerator(combo) {
  return combo.replace(/^Ctrl\+/, 'Control+');
}
const api = { keyName, fromEvent, validate, toAccelerator, ALLOWED_KEYS, GAME_KEYS };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.Combo = api;
})();
