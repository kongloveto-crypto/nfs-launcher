'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { mayBeShortcut, decideKey, shouldCancelClose } = require('../src/main/lockPolicy');

const base = { toggleCombo: 'Ctrl+Alt+F', exitCombo: 'Ctrl+Alt+Shift+P', capturing: false, blockAltSpace: true };
const locked = { ...base, locked: true };
const free = { ...base, locked: false };
const key = (code, mods = {}) => ({ type: 'keyDown', code, ...mods });

test('modo protegido: bloqueia Alt+F4 e F11; Alt+Espaço vai para o jogo sem abrir o menu do Windows', () => {
  assert.equal(decideKey(key('F4', { alt: true }), locked), 'block-notify');
  assert.equal(decideKey(key('Space', { alt: true }), locked), 'altspace-to-game');
  assert.equal(decideKey(key('F11'), locked), 'block');
  assert.equal(decideKey(key('F11', { shift: true }), locked), 'block');
});
test('Alt+Espaço pode ser liberado; Alt+F4 continua bloqueado', () => {
  const open = { ...locked, blockAltSpace: false };
  assert.equal(decideKey(key('Space', { alt: true }), open), 'pass');
  assert.equal(decideKey(key('F4', { alt: true }), open), 'block-notify');
});
test('Alt+Enter: tela cheia só na primeira batida; Enter e outras combinações seguem para o jogo', () => {
  for (const code of ['Enter', 'NumpadEnter']) {
    assert.equal(decideKey(key(code, { alt: true }), free), 'toggle-fullscreen');
    assert.equal(decideKey(key(code, { alt: true }), locked), 'exit-protected');
    assert.equal(decideKey(key(code, { alt: true, isAutoRepeat: true }), free), 'block');
    assert.equal(decideKey(key(code, { alt: true, isAutoRepeat: true }), locked), 'block');
  }
  assert.equal(decideKey(key('KeyF', { control: true }), { ...free, toggleCombo: 'Ctrl+F' }), 'toggle-fullscreen'); // o atalho configurado continua valendo
  assert.equal(decideKey(key('KeyF', { control: true }), { ...locked, toggleCombo: 'Ctrl+F' }), 'exit-protected');
  assert.equal(decideKey(key('Enter', { alt: true, shift: true }), free), 'pass');
  assert.equal(decideKey(key('Enter', { alt: true, control: true }), free), 'pass');
  assert.equal(decideKey(key('Enter', { alt: true }), { ...free, capturing: true }), 'pass');
  assert.equal(mayBeShortcut(key('Enter')), false);
  assert.equal(mayBeShortcut(key('Enter', { alt: true })), true);
});
test('Ctrl+W chega ao jogo e não fecha nada', () => {
  assert.equal(decideKey(key('KeyW', { control: true }), locked), 'pass');
  assert.equal(decideKey(key('KeyW', { control: true }), free), 'pass');
});
test('modo janela: fora do jogo nada é bloqueado; Alt+F4 sempre fecha', () => {
  assert.equal(decideKey(key('F4', { alt: true }), free), 'pass');
  assert.equal(decideKey(key('Space', { alt: true }), free), 'pass');
  assert.equal(decideKey(key('F4', { alt: true }), { ...free, playing: true }), 'pass');
});
test('modo janela durante o jogo: Alt+Espaço vai para o jogo sem abrir o menu (opção)', () => {
  assert.equal(decideKey(key('Space', { alt: true }), { ...free, playing: true }), 'altspace-to-game');
  assert.equal(decideKey(key('Space', { alt: true, isAutoRepeat: true }), { ...free, playing: true }), 'altspace-to-game');
  assert.equal(decideKey(key('Space', { alt: true }), { ...free, playing: true, blockAltSpace: false }), 'pass');
  assert.equal(decideKey(key('Space'), { ...free, playing: true }), 'pass');
});
test('Alt+Espaço é pego antes do Windows só com a janela em foco, o jogo na tela e a opção ligada', () => {
  const { wantAltSpaceCatch, ALT_SPACE_ACCELS } = require('../src/main/lockPolicy');
  const on = { win32: true, blockAltSpace: true, focused: true, playing: true, capturing: false };
  assert.equal(wantAltSpaceCatch(on), true);
  assert.equal(wantAltSpaceCatch({ ...on, focused: false }), false, 'outro programa em foco: Alt+Espaço é do Windows');
  assert.equal(wantAltSpaceCatch({ ...on, playing: false }), false, 'telas do app: menu normal');
  assert.equal(wantAltSpaceCatch({ ...on, blockAltSpace: false }), false);
  assert.equal(wantAltSpaceCatch({ ...on, capturing: true }), false, 'gravando atalho nas configurações');
  assert.equal(wantAltSpaceCatch({ ...on, win32: false }), false);
  assert.deepEqual(ALT_SPACE_ACCELS, ['Alt+Space', 'Alt+Shift+Space'], 'Shift (marcha) junto também abre o menu');
});
test('F11 e atalho de alternância entram em tela cheia no modo janela', () => {
  assert.equal(decideKey(key('F11'), free), 'toggle-fullscreen');
  assert.equal(decideKey(key('KeyF', { control: true, alt: true }), free), 'toggle-fullscreen');
});
test('Ctrl+F (padrão) entra e sai da tela cheia, inclusive do modo protegido', () => {
  const ctx = { ...base, toggleCombo: 'Ctrl+F' };
  const e = key('KeyF', { control: true });
  assert.equal(decideKey(e, { ...ctx, locked: false }), 'toggle-fullscreen');
  assert.equal(decideKey(e, { ...ctx, locked: true }), 'exit-protected');
  assert.equal(require('../src/main/settings').DEFAULTS.toggleCombo, 'Ctrl+F');
});
test('quem tinha o padrão antigo Ctrl+Alt+F passa para Ctrl+F; atalho personalizado fica', () => {
  const s = require('../src/main/settings');
  assert.equal(s.sanitize({ version: 3, toggleCombo: 'Ctrl+Alt+F' }).toggleCombo, 'Ctrl+F');
  assert.equal(s.sanitize({ version: 3, toggleCombo: 'Ctrl+Alt+K' }).toggleCombo, 'Ctrl+Alt+K');
  assert.equal(s.sanitize({ version: 4, toggleCombo: 'Ctrl+Alt+F' }).toggleCombo, 'Ctrl+Alt+F');
});
test('atalho de saída só age no modo protegido', () => {
  const e = key('KeyP', { control: true, alt: true, shift: true });
  assert.equal(decideKey(e, locked), 'exit-protected');
  assert.equal(decideKey(e, free), 'pass');
});
test('teclas do jogo passam sempre', () => {
  for (const k of [key('KeyW'), key('KeyA'), key('KeyS'), key('KeyD'), key('Space'), key('ArrowUp'),
    key('Enter'), key('ControlLeft', { control: true }), key('ShiftLeft', { shift: true }),
    key('AltLeft', { alt: true }), key('Escape'), key('KeyR', { control: true }), key('Tab'), key('F8'), key('F12')]) {
    assert.equal(decideKey(k, locked), 'pass', k.code);
    assert.equal(decideKey(k, free), 'pass', k.code);
  }
});
test('durante a gravação de atalho nada é interceptado', () => {
  assert.equal(decideKey(key('F4', { alt: true }), { ...locked, capturing: true }), 'pass');
  assert.equal(decideKey(key('F11'), { ...free, capturing: true }), 'pass');
});
test('keyUp é ignorado', () => {
  assert.equal(decideKey({ type: 'keyUp', code: 'F4', alt: true }, locked), 'pass');
});
test('fechamento: cancelado só se protegido e sem encerramento legítimo', () => {
  assert.equal(shouldCancelClose({ locked: true, quitting: false }), true);
  assert.equal(shouldCancelClose({ locked: true, quitting: true }), false);
  assert.equal(shouldCancelClose({ locked: false, quitting: false }), false);
});

test('Ctrl+Alt+O abre as configurações só fora do modo protegido', () => {
  const e = key('KeyO', { control: true, alt: true });
  assert.equal(decideKey(e, free), 'open-settings');
  assert.equal(decideKey(e, locked), 'pass');
});

test('filtro rápido: teclas do jogo nem chegam à decisão', () => {
  for (const k of [key('KeyW'), key('Space'), key('ArrowLeft'), key('ShiftLeft', { shift: true }), key('F5'),
    key('AltLeft', { alt: true }), key('ControlLeft', { control: true }), key('KeyD', { shift: true }),
    { type: 'keyUp', code: 'F4', alt: true }, { type: 'char', code: 'KeyA' }, null]) {
    assert.equal(mayBeShortcut(k), false, JSON.stringify(k));
  }
});
test('filtro rápido: todo atalho do app passa pelo filtro', () => {
  for (const k of [key('F11'), key('F4', { alt: true }), key('Space', { alt: true }), key('KeyO', { control: true, alt: true }),
    key('KeyP', { control: true, alt: true, shift: true }), key('KeyF', { control: true })]) {
    assert.equal(mayBeShortcut(k), true, k.code);
  }
});
test('filtro + decisão: nada que o filtro descarta seria atalho', () => {
  const codes = ['KeyA', 'KeyF', 'KeyO', 'KeyP', 'KeyW', 'Space', 'F4', 'F5', 'F11', 'Enter', 'ArrowUp', 'AltLeft', 'ShiftLeft'];
  const combos = [{}, { shift: true }, { control: true }, { alt: true }, { control: true, alt: true }, { control: true, alt: true, shift: true }];
  for (const ctx of [locked, free, { ...free, toggleCombo: 'Ctrl+F', exitCombo: 'Ctrl+Shift+F' }]) {
    for (const code of codes) {
      for (const m of combos) {
        const e = key(code, m);
        if (!mayBeShortcut(e)) assert.equal(decideKey(e, ctx), 'pass', `${JSON.stringify(m)} ${code}`);
      }
    }
  }
});
test('F1–F10 e F12 (inclusive F5) sempre vão para o jogo', () => {
  for (const f of ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F12']) {
    assert.equal(decideKey(key(f), free), 'pass', f);
    assert.equal(decideKey(key(f), locked), 'pass', f);
    assert.equal(decideKey(key(f, { control: true }), free), 'pass', `Ctrl+${f}`);
  }
});
