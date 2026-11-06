'use strict';
(function () {
// Textos da interface em inglês. O português fica no próprio ui.html; cada elemento traduzível tem uma chave:
// data-t (conteúdo), data-tt (dica do mouse, "title") e data-ta (rótulo de acessibilidade).
// Os textos são constantes deste arquivo (nada vindo de fora), então podem ter <b>, <i> e <small>.
const EN = {
  cTipsT: 'Tips (Ctrl+Alt+I)', cTipsA: 'Tips',
  cFsA: 'Toggle fullscreen',
  cHomeT: 'Back to home (closes the game)', cHomeA: 'Back to home',
  cReloadA: 'Reload the game',
  settings: 'Settings', close: 'Close',
  tagline: 'Pick the game and press <b>START</b>',
  hWindow: 'Window and fullscreen',
  sStartFs: 'Start in fullscreen',
  hTextures: 'Textures (NFSU2)', cTexN: 'HD textures',
  texTitle: 'HD textures',
  texOn: 'Better textures <small>(when off, the game keeps its original textures)</small>',
  texHint: 'Nothing changes until you apply · Esc goes back',
  texCancel: 'Back',
  texApply: 'Apply',
  texChoose: 'Choose the parts…',
  texChooseNote: 'Asphalt, sky, buildings and more: which mod each one comes from.',
  texPartsNote:'Choose which mod each part comes from. If the chosen mod lacks a texture of that part, the others fill it in. “Original” leaves the part as in the game.',
  sHdTextures: 'Better textures <small>(more detailed asphalt, buildings, trees and sky, from the Redux, Definitive Edition and NextGen mods, together with the detailed map. The app turns on the game\'s detailed map when it opens; the HUD stays as you left it. Applies when the game starts or reloads)</small>',
  sUnblock: 'DirectX 11 mode (Dawn D3D11) <small>(for graphics without DirectX 12. Starts the game without HD textures and without the extra picture and performance options; you can turn them back on later. It may cause picture errors or freezes)</small>',
  sLighter: 'Ease the processor (Dawn skip_validation) <small>(stops checking each graphics command. Small gain, ~0.1 ms per frame. If the game has a graphics error, it may freeze)</small>',
  sNewDrawing: 'Draw the screen the new way (Graphite + Delegated Compositing) <small>(another way of drawing the picture, and Windows assembles the final picture. While playing on an RTX 4060: frames 3% to 10% faster and up to 30% fewer missed frames)</small>',
  sAntiAlias: 'Anti-aliasing (FXAA) <small>(makes edges smoother. Costs ~0.27 ms per frame and takes a little sharpness from text and details)</small>',
  hImage: 'Game picture',
  sImage: 'Picture filter (CSS filter: saturate, contrast and feConvolveMatrix) <small>(changes color and sharpness right away, without reopening the app. The color-only modes barely cost anything; the sharp ones cost a little, so check with F8)</small>',
  imgMode: 'Mode', imgSoft: 'Soft', imgVivid: 'Vivid', imgStrong: 'Intense', imgSharp: 'Sharp', imgVividSharp: 'Vivid and sharp',
  advanced: 'Advanced',
  sPrepare: 'Prepare the game while loading <small>(optimizes the whole game at the start, not during the race. Heavier in the first seconds and may reduce stutters later)</small>',
  hPerf: 'Performance',
  perfNote: 'Priority applies right away; the others when the app is reopened. The numbers come from tests on an RTX 4060 at 1440p, outside the game: compare while playing, with F8.',
  restart: 'Reopen the app to apply', restartNote: 'The open session will be closed (save in the game first).',
  sPrio: '“Above normal” priority for the game <small>(Windows favors the game. It only helps with other heavy programs open)</small>',
  hKeys: 'Shortcuts',
  kToggle: 'Enter and leave fullscreen <small class="muted">(also leaves protected mode; Alt+Enter does the same)</small>',
  kExit: 'Leave protected mode <small class="muted">(works even when the window is not focused)</small>',
  kNote: 'Use Ctrl or Alt (Shift optional) + a key the game does not use (F, G, K, L, Q, T, U, V, Y, Z, 5–0, F1–F7…). Game keys (WASD, arrows, Space, C, B, R, M, P, 1–4…) only with Ctrl+Alt+Shift, because Ctrl/Shift change gears and Alt is nitrous. F11 also enters fullscreen in window mode. <b>Ctrl+Alt+O</b> opens and closes these settings; <b>Esc</b> goes back. F5 and the other function keys go to the game.',
  hGpu: 'WebGPU and GPU', gpuTest: 'Test again',
  hDiag: 'Stutter diagnostics',
  diagNote: '<b>Report</b>: saves a text file with the versions, graphics card and driver, monitors (resolution and Hz) and app options, plus the known problems the app can detect. It stays on your PC; send it to whoever is helping. Create it with the game open, right after a stutter.',
  diag: 'Save diagnostic report',
  hMaint: 'Maintenance', reload: 'Restart the game', cache: 'Clear cache',
  maintNote: '“Clear cache” does not touch your saves.',
  escBack: 'Esc also goes back',
  loading: 'Loading the game…',
  errTitle: 'Could not load the game', errRetry: 'Trying to reconnect automatically every 5 seconds.',
  fontDown: 'Smaller text', fontUp: 'Larger text',
  retry: 'Try now', dnsTry: 'Try with secure DNS', exitProt: 'Leave protected mode', quitApp: 'Close the app',
  hCustom: 'Customization',
  customNote: 'Replace the home screen <b>background</b> and the <b>cover</b> (the disc) of each game with a PNG or JPG image from your PC. The cover is round: the app uses the middle square of the image. “Default” goes back to the original image.',
  hUpdate: 'Updates',
  updNote: 'When a new version is available, the download button appears on the home screen. Nothing is downloaded or installed on its own and nothing from your PC is sent.',
  updCheck: 'Check now', updOpen: 'Open the versions folder', updGet: 'Download',
  hSaves: 'Save copies (NFSU2)',
  savesNote: 'When it opens, the app keeps a copy of your save, only if it changed. The last 2 versions stay, only on your PC, and nothing is sent. The app never puts a copy back by itself. <b>Only restore if you lost your save:</b> a copy may be older than your game and replaces what is in it. To bring one back: in the game, under <b>Saved games &gt; Restore</b>, pick the newest file in the folder.',
  savesOpen: 'Open the copies folder', mySaves: 'My saves',
};

const orig = new Map(); // português original de cada elemento (lido do ui.html na primeira troca)
function apply(lang) {
  const en = lang === 'en';
  document.documentElement.lang = en ? 'en' : 'pt-BR';
  const swap = (sel, attr, get, set) => {
    for (const n of document.querySelectorAll(sel)) {
      const k = n.getAttribute(attr);
      const id = `${attr}:${k}`;
      if (!orig.has(n)) orig.set(n, {});
      const o = orig.get(n);
      if (!(id in o)) o[id] = get(n);
      set(n, en && EN[k] !== undefined ? EN[k] : o[id]);
    }
  };
  swap('[data-t]', 'data-t', (n) => n.innerHTML, (n, v) => { n.innerHTML = v; });
  swap('[data-tt]', 'data-tt', (n) => n.title, (n, v) => { n.title = v.replace(/<[^>]+>/g, ''); });
  swap('[data-ta]', 'data-ta', (n) => n.getAttribute('aria-label'), (n, v) => { n.setAttribute('aria-label', v.replace(/<[^>]+>/g, '')); });
}

// Mensagens de atalho inválido vêm do combo.js em português: tradução para o inglês.
const COMBO_EN = {
  'Combinação vazia.': 'Empty combination.',
  'Tecla não suportada.': 'Key not supported.',
  'Use apenas Ctrl, Alt e Shift (a tecla Windows é reservada pelo sistema).': 'Use only Ctrl, Alt and Shift (the Windows key is reserved by the system).',
  'Modificador repetido.': 'Repeated modifier.',
  'Inclua Ctrl ou Alt para evitar disparos acidentais durante o jogo.': 'Include Ctrl or Alt to avoid accidental triggers during the game.',
  'Formato inválido.': 'Invalid format.',
  'Combinação reservada pelo Windows ou bloqueada pelo app.': 'Combination reserved by Windows or blocked by the app.',
  'Os dois atalhos não podem ser iguais.': 'The two shortcuts cannot be the same.',
};
function comboError(msg, lang) {
  if (lang !== 'en' || !msg) return msg;
  if (COMBO_EN[msg]) return COMBO_EN[msg];
  const m = /^(\S+) é tecla do jogo/.exec(msg);
  if (m) return `${m[1]} is a game key: with Ctrl (gear) or Alt (nitrous) it fires by accident during a race. Use a key the game does not use (F, G, K, L, Q, T, U, V, Y, Z, 5–0, F1–F7) or Ctrl+Alt+Shift.`;
  return msg;
}

const api = { EN, apply, comboError };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.I18n = api;
})();
