'use strict';
require('node:test')('idioma do app: pt por padrão, só pt/en aceitos', () => {
  const assert = require('node:assert/strict');
  const s = require('../src/main/settings');
  assert.equal(s.sanitize({}).lang, 'pt');
  assert.equal(s.sanitize({ lang: 'en' }).lang, 'en');
  assert.equal(s.sanitize({ lang: 'pt-BR' }).lang, 'pt');
  assert.equal(s.applyChange(s.DEFAULTS, 'lang', 'en').cfg.lang, 'en');
  assert.equal(s.applyChange(s.DEFAULTS, 'lang', 'xx').ok, false);
  // Jogo lembrado: NFSU2 na primeira vez; guarda o último iniciado; id desconhecido volta ao padrão.
  assert.equal(s.sanitize({}).game, 'nfsu2');
  assert.equal(s.sanitize({ game: 'nfsmw' }).game, 'nfsmw');
  assert.equal(s.sanitize({ game: 'xx' }).game, 'nfsu2');
  const fs = require('fs');
  const { GAMES } = require('../src/main/config');
  for (const g of Object.values(GAMES)) {
    assert.ok(fs.existsSync(require('path').join(__dirname, '..', 'src', 'renderer', g.disc)), `CD ausente: ${g.disc}`);
  }
  assert.equal(GAMES.nfsu2.tips, true);
  assert.equal(GAMES.nfsmw.tips, false, 'dicas do NFSU2 não aparecem no NFSMW');
  assert.equal(GAMES.nfsc.tips, false, 'dicas do NFSU2 não aparecem no Carbon');
  assert.equal(s.sanitize({ game: 'nfsc' }).game, 'nfsc');
  for (const g of Object.values(GAMES)) {
    assert.ok(fs.existsSync(require('path').join(__dirname, '..', 'src', 'renderer', 'bg', `${g.id}.jpg`)), `fundo ausente: ${g.id}`);
  }
  // Todo texto em inglês do ui.html tem tradução, e toda tradução é usada.
  const html = fs.readFileSync(require('path').join(__dirname, '..', 'src', 'renderer', 'ui.html'), 'utf8');
  const keys = new Set([...html.matchAll(/data-t[ta]?="([^"]+)"/g)].map((m) => m[1]));
  const { EN } = require('../src/renderer/i18n');
  for (const k of keys) assert.ok(k in EN, `sem inglês: ${k}`);
  for (const k of Object.keys(EN)) assert.ok(keys.has(k), `tradução sem uso: ${k}`);
});
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const s = require('../src/main/settings');

test('padrões: modo janela, tela inicial, proteção e prioridade ativas', () => {
  const d = s.sanitize({});
  assert.equal(d.startFullscreen, false);
  assert.equal(d.showHome, true);
  assert.equal(d.protectFullscreen, true);
  assert.equal(d.blockAltSpace, true);
  assert.equal(d.highPriority, false);
  assert.equal(d.showCorner, true);
  assert.equal('lowLatency' in d, false, 'o app não mexe no VSync');
});
test('quem tinha a baixa latência ligada volta ao normal e a opção não existe mais', () => {
  assert.equal('lowLatency' in s.sanitize({ lowLatency: true }), false);
  assert.equal(s.applyChange(s.sanitize({}), 'lowLatency', true).ok, false);
});
test('Graphite e Delegated: uma opção só, ligada por padrão, também para quem já tinha o app; desmarcar fica guardado', () => {
  const d = s.sanitize({});
  assert.equal(d.newDrawing, true);
  assert.equal('windowsCompose' in d, false);
  const old = s.sanitize({ version: 5, newDrawing: false, windowsCompose: false });
  assert.equal(old.newDrawing, true);
  assert.equal('windowsCompose' in old, false);
  assert.equal(s.applyChange(d, 'windowsCompose', false).ok, false);
  const off = s.sanitize(s.applyChange(d, 'newDrawing', false).cfg);
  assert.equal(off.newDrawing, false);
});
test('DNS seguro: oferecido só em falha de conexão', () => {
  const { errorKind, offersSecureDns } = require('../src/main/connError');
  assert.equal(offersSecureDns(errorKind(-105)), true, 'nome não resolvido');
  assert.equal(offersSecureDns(errorKind(-118)), true, 'tempo esgotado');
  assert.equal(offersSecureDns(errorKind(503)), false, 'site fora do ar');
  assert.equal(offersSecureDns(errorKind(-1)), false, 'jogo caído');
  const d = s.sanitize({});
  assert.equal(d.secureDns, 'off', 'desligado por padrão');
  assert.equal(s.sanitize({ secureDns: 'google' }).secureDns, 'google', 'fica guardado entre aberturas');
  assert.equal(s.sanitize({ secureDns: 'constructor' }).secureDns, 'off');
  assert.equal(s.applyChange(d, 'secureDns', 'google').ok, false, 'fora das configurações');
  assert.deepEqual(Object.keys(require('../src/main/config').SECURE_DNS), ['cloudflare', 'google'], 'ordem de tentativa');
});
test('sanitize descarta lixo e combinações inválidas', () => {
  const c = s.sanitize({ startFullscreen: 'sim', exitCombo: 'Alt+F4', bounds: { x: 1 } });
  assert.equal(c.startFullscreen, false);
  assert.equal(c.exitCombo, s.DEFAULTS.exitCombo);
  assert.equal(c.bounds, null);
});
test('preferências da versão anterior continuam válidas', () => {
  const c = s.sanitize({ version: 1, startFullscreen: true, exitCombo: 'Ctrl+Alt+K' });
  assert.equal(c.startFullscreen, true);
  assert.equal(c.exitCombo, 'Ctrl+Alt+K');
  assert.equal(c.highPriority, false);
});
test('atalhos iguais voltam ao padrão (evita ficar sem saída)', () => {
  const c = s.sanitize({ toggleCombo: 'Ctrl+Alt+K', exitCombo: 'Ctrl+Alt+K' });
  assert.equal(c.toggleCombo, s.DEFAULTS.toggleCombo);
  assert.equal(c.exitCombo, s.DEFAULTS.exitCombo);
});
test('applyChange valida', () => {
  const c = s.sanitize({});
  assert.equal(s.applyChange(c, 'exitCombo', 'F11').ok, false);
  assert.equal(s.applyChange(c, 'exitCombo', c.toggleCombo).ok, false);
  assert.equal(s.applyChange(c, 'exitCombo', 'Ctrl+Alt+K').cfg.exitCombo, 'Ctrl+Alt+K');
  assert.equal(s.applyChange(c, 'startFullscreen', 1).ok, false);
  assert.equal(s.applyChange(c, 'highPriority', true).cfg.highPriority, true);
  assert.equal(s.applyChange(c, 'showCorner', false).ok, false, 'opção fora das configurações');
  assert.equal(s.applyChange(c, 'maximized', true).ok, false);
  assert.equal(s.applyChange(c, 'foo', true).ok, false);
});
test('opções fora das configurações ficam sempre ligadas, mesmo em quem tinha desligado', () => {
  const c = s.sanitize({ showHome: false, protectFullscreen: false, blockAltSpace: false, showCorner: false, sounds: false, discord: false });
  for (const k of ['showHome', 'protectFullscreen', 'blockAltSpace', 'showCorner', 'sounds', 'discord']) {
    assert.equal(c[k], true, k);
    assert.equal(s.applyChange(c, k, false).ok, false, k);
  }
});
test('save/load persistem e arquivo corrompido volta ao padrão', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nfsu2-')), 'settings.json');
  const c = { ...s.sanitize({}), startFullscreen: true, bounds: { x: 10, y: 20, width: 1280, height: 720 } };
  assert.ok(s.save(f, c));
  assert.deepEqual(s.load(f), c);
  fs.writeFileSync(f, '{corrompido');
  assert.deepEqual(s.load(f), s.DEFAULTS);
});
