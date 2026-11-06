'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const mf = require('../src/main/modFiles');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mods-'));
function put(root, rel, data) {
  const p = path.join(root, ...rel.split('/'));
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, data);
  return p;
}
const SITE = {
  v: 1,
  files: [
    { p: 'CARS', d: 1 }, { p: 'CARS/240SX', d: 1 }, { p: 'CARS/240SX/TEXTURES.BIN', s: 100, m: 5 },
    { p: 'TEXPACKS', d: 1 }, { p: 'TEXPACKS/uhud.pak', s: 9, m: 7 },
  ],
  blocks: { url: '/data-blocks/v2/', size: 1048576, max: 8 },
};

test('scan: árvore do jogo, sem pastas vazias, nomes estranhos ou arquivo vazio', () => {
  const d = tmp();
  put(d, 'TEXPACKS/meu.pak', 'abc');
  put(d, 'CARS/240SX/textures.bin', 'xyz1');
  put(d, 'vazio.txt', '');
  put(d, 'ru:im.txt', 'x');
  fs.mkdirSync(path.join(d, 'PASTA'));
  const got = mf.scan(d).map((x) => [x.p, x.s]).sort();
  assert.deepStrictEqual(got, [['CARS/240SX/textures.bin', 4], ['TEXPACKS/meu.pak', 3]]);
  assert.deepStrictEqual(mf.scan(path.join(d, 'nao-existe')), []);
});

test('patchManifest: troca arquivo do site (mantém o nome dele) e acrescenta novo com as pastas', () => {
  const mods = [
    { p: 'CARS/240SX/textures.bin', file: 'a', s: 4, m: 50 },
    { p: 'TEXPACKS/meu.pak', file: 'b', s: 3, m: 60 },
    { p: 'MODS/X/novo.bin', file: 'c', s: 2, m: 70 },
  ];
  const { manifest, served } = mf.patchManifest(SITE, mods);
  const by = Object.fromEntries(manifest.files.map((f) => [f.p, f]));
  assert.deepStrictEqual(by['CARS/240SX/TEXTURES.BIN'], { p: 'CARS/240SX/TEXTURES.BIN', s: 4, m: 50 });
  assert.deepStrictEqual(by['TEXPACKS/meu.pak'], { p: 'TEXPACKS/meu.pak', s: 3, m: 60 });
  assert.ok(by.MODS.d && by['MODS/X'].d && by['MODS/X/novo.bin'].s === 2);
  assert.deepStrictEqual([...served.keys()].sort(), ['CARS/240SX/TEXTURES.BIN', 'MODS/X/novo.bin', 'TEXPACKS/meu.pak']);
  assert.strictEqual(by['TEXPACKS/uhud.pak'].s, 9, 'o resto da lista fica igual');
  assert.strictEqual(SITE.files[2].s, 100, 'a lista original não é alterada');
  assert.deepStrictEqual(manifest.blocks, SITE.blocks);
});

test('patchManifest: não troca pasta por arquivo nem arquivo por pasta', () => {
  const { served } = mf.patchManifest(SITE, [
    { p: 'CARS/240SX', file: 'a', s: 1, m: 1 },
    { p: 'TEXPACKS/uhud.pak/x.bin', file: 'b', s: 1, m: 1 },
  ]);
  assert.strictEqual(served.size, 0);
  assert.throws(() => mf.patchManifest({}, []));
});

test('encodePath: igual ao jogo (cada parte do caminho codificada)', () => {
  assert.strictEqual(mf.encodePath('TEXPACKS/meu pack.pak'), 'TEXPACKS/meu%20pack.pak');
});

test('install: sem mods não liga nada; com mods, liga e desliga o https só quando pedido', () => {
  assert.strictEqual(mf.install({}, { mods: [], allowed: () => true }), null);
  const calls = [];
  const ses = { protocol: { handle: (s) => calls.push('on ' + s), unhandle: (s) => calls.push('off ' + s) } };
  const m = mf.install(ses, { mods: [{ p: 'TEXPACKS/a.pak', file: 'x', s: 1, m: 1 }], allowed: () => true });
  m.active(false); m.active(true); m.active(true); m.active(false);
  assert.deepStrictEqual(calls, ['on https', 'off https']);
});

test('route: só o que é do mod; resto segue para o site', () => {
  const served = new Map([['TEXPACKS/meu pack.pak', { s: 3, m: 60 }]]);
  assert.deepStrictEqual(mf.route('https://nfsu2.xyz/data-manifest', served), { kind: 'manifest' });
  assert.deepStrictEqual(mf.route('https://nfsu2.xyz/data-blocks/v2/TEXPACKS/meu%20pack.pak?b=0&n=1&m=60&s=3', served),
    { kind: 'blocks', p: 'TEXPACKS/meu pack.pak', b: 0, n: 1, m: 60, s: 3 });
  assert.deepStrictEqual(mf.route('https://nfsu2.xyz/data/TEXPACKS/meu%20pack.pak', served), { kind: 'file', p: 'TEXPACKS/meu pack.pak' });
  assert.strictEqual(mf.route('https://nfsu2.xyz/data/TEXPACKS/uhud.pak', served), null);
  assert.strictEqual(mf.route('https://nfsu2.xyz/data-blocks/v2/TEXPACKS/meu%20pack.pak?b=-1&n=1', served).kind, 'bad');
  assert.strictEqual(mf.route('https://nfsu2.xyz/data/%E0%A4%A', served), null);
  assert.strictEqual(mf.route('nada', served), null);
});

test('blockSpan e rangeSpan', () => {
  const mod = { s: mf.BLOCK * 2 + 10, m: 9 };
  assert.deepStrictEqual(mf.blockSpan({ b: 1, n: 8, m: 9, s: mod.s }, mod), { start: mf.BLOCK, end: mod.s });
  assert.deepStrictEqual(mf.blockSpan({ b: 0, n: 1, m: 9, s: mod.s }, mod), { start: 0, end: mf.BLOCK });
  assert.strictEqual(mf.blockSpan({ b: 0, n: 1, m: 8, s: mod.s }, mod), null, 'lista antiga');
  assert.strictEqual(mf.blockSpan({ b: 3, n: 1, m: 9, s: mod.s }, mod), null, 'depois do fim');
  assert.strictEqual(mf.rangeSpan(null, 10), null);
  assert.deepStrictEqual(mf.rangeSpan('bytes=2-4', 10), { start: 2, end: 5 });
  assert.deepStrictEqual(mf.rangeSpan('bytes=2-', 10), { start: 2, end: 10 });
  assert.deepStrictEqual(mf.rangeSpan('bytes=8-99', 10), { start: 8, end: 10 });
  assert.strictEqual(mf.rangeSpan('bytes=10-', 10), false);
  assert.strictEqual(mf.rangeSpan('bytes=-5', 10), false);
});

test('readSpan lê o trecho exato', () => {
  const d = tmp();
  const f = put(d, 'a.bin', Buffer.from('0123456789'));
  assert.strictEqual(mf.readSpan(f, 2, 5).toString(), '234');
  assert.strictEqual(mf.readSpan(f, 8, 12), null, 'arquivo menor que o esperado');
});
