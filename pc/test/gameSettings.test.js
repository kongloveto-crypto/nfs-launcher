'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const gs = require('../src/main/gameSettings');

const HEAD = '# NFSU2 settings\r\n# texto do jogo, com acento: ação\r\n';

test('Texturas HD: original vira map; desligar volta ao que era', () => {
  const t = `${HEAD}fps = 120\r\nui_textures = original\r\nrender = scale:1\r\n`;
  const a = gs.plan(t, { on: true });
  assert.ok(a.changed && a.uiOn);
  assert.strictEqual(a.prev, 'ui_textures = original');
  assert.strictEqual(a.text, t.replace('ui_textures = original', 'ui_textures = map'));
  const b = gs.plan(a.text, { on: false, prev: a.prev });
  assert.ok(b.changed);
  assert.strictEqual(b.prev, null);
  assert.strictEqual(b.text, t);
});

test('Texturas HD: sem a linha, acrescenta no fim; desligar tira', () => {
  const t = `${HEAD}#ui_textures = original\r\nfps = 60\r\n`;
  const a = gs.plan(t, { on: true });
  assert.strictEqual(a.prev, '');
  assert.ok(a.text.endsWith('fps = 60\r\nui_textures = map\r\n'));
  assert.strictEqual(gs.plan(a.text, { on: false, prev: '' }).text, t);
});

test('Texturas HD: HUD HD (uhud) e map do jogador nunca mudam, ligando ou desligando', () => {
  for (const v of ['uhud', 'map', 'UHUD']) {
    const t = `${HEAD}ui_textures = ${v}\r\n`;
    for (const on of [true, false]) {
      const r = gs.plan(t, { on, prev: null });
      assert.ok(!r.changed, `${v} ${on}`);
      assert.ok(r.uiOn);
    }
  }
  // O jogador trocou depois para uhud: desligar não desfaz nada e esquece a linha antiga.
  const r = gs.plan(`${HEAD}ui_textures = uhud\r\n`, { on: false, prev: 'ui_textures = original' });
  assert.ok(!r.changed);
  assert.strictEqual(r.prev, null);
});

test('Texturas HD: mapa escolhido à mão (NFSU2_MAP_TEXTURES) fica como está', () => {
  const t = `${HEAD}NFSU2_MAP_TEXTURES = original\r\nui_textures = original\r\n`;
  const r = gs.plan(t, { on: true });
  assert.ok(!r.changed);
  assert.strictEqual(r.text, t);
});

test('Texturas HD: grava no lugar, com cópia antes; sem arquivo ou com dois, não escreve', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nfs-gs-'));
  const bak = path.join(root, 'copias');
  const put = (rel, data) => { const p = path.join(root, 'fs', rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); return p; };
  try {
    assert.strictEqual((await gs.run({ root: path.join(root, 'fs'), backupDir: bak, on: true })).why, 'sem settings.ini');
    const text = `${HEAD}ui_textures = original\r\n`;
    const file = put('000/t/00/00000012', Buffer.from(text, 'latin1'));
    put('000/t/00/00000013', 'outro arquivo do jogo');
    const r = await gs.run({ root: path.join(root, 'fs'), backupDir: bak, on: true });
    assert.ok(r.changed && r.uiOn);
    assert.strictEqual(fs.readFileSync(file, 'latin1'), text.replace('original', 'map'));
    assert.strictEqual(fs.readFileSync(path.join(bak, gs.BACKUP), 'latin1'), text);
    assert.deepStrictEqual(fs.readdirSync(bak), [gs.BACKUP]); // nada pela metade
    // De novo ligado: nada muda. Desligado com a linha do app: volta ao original.
    assert.ok(!(await gs.run({ root: path.join(root, 'fs'), backupDir: bak, on: true, prev: r.prev })).changed);
    const off = await gs.run({ root: path.join(root, 'fs'), backupDir: bak, on: false, prev: r.prev });
    assert.ok(off.changed);
    assert.strictEqual(fs.readFileSync(file, 'latin1'), text);
    put('001/t/00/00000001', Buffer.from(text, 'latin1'));
    const two = await gs.run({ root: path.join(root, 'fs'), backupDir: bak, on: true });
    assert.strictEqual(two.why, 'mais de um settings.ini');
    assert.strictEqual(fs.readFileSync(file, 'latin1'), text);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
