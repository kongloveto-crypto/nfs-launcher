'use strict';
const test = require('node:test');
const assert = require('node:assert');
const cc = require('../src/main/cacheClean');

const many = (extra) => ({ files: [
  { p: 'TEXPACKS', d: 1 },
  ...Array.from({ length: 25 }, (_, i) => ({ p: `DATA/f${i}.bin`, s: 10 + i, m: 100 })),
  ...extra,
] });

test('mesmo nome do jogo', () => {
  assert.strictEqual(cc.cacheKey({ p: 'TEXPACKS/detailed.pak', s: 5, m: 7 }), 'TEXPACKS_detailed.pak.5.7');
});

test('apaga versões velhas do mesmo arquivo e o .have, guarda a atual', () => {
  const m = many([{ p: 'TEXPACKS/detailed.pak', s: 500, m: 9 }]);
  const names = [
    'TEXPACKS_detailed.pak.500.9', 'TEXPACKS_detailed.pak.500.9.have',
    'TEXPACKS_detailed.pak.400.8', 'TEXPACKS_detailed.pak.400.8.have',
    'TEXPACKS_detailed.pak.450.7',
    'DATA_f3.bin.13.100', 'DATA_f3.bin.13.100.have',
  ];
  assert.deepStrictEqual(cc.staleNames(names, m),
    ['TEXPACKS_detailed.pak.400.8', 'TEXPACKS_detailed.pak.400.8.have', 'TEXPACKS_detailed.pak.450.7']);
});

test('arquivo que saiu da lista também sai; nomes fora do formato ficam', () => {
  const names = ['VELHO_x.pak.1.2', 'save.dat', 'outra-coisa', 'DATA_f0.bin.10.100'];
  assert.deepStrictEqual(cc.staleNames(names, many([])), ['VELHO_x.pak.1.2']);
});

test('lista estranha ou vazia: não apaga nada', () => {
  const names = ['TEXPACKS_detailed.pak.400.8'];
  assert.deepStrictEqual(cc.staleNames(names, null), []);
  assert.deepStrictEqual(cc.staleNames(names, { files: [{ p: 'a', s: 1, m: 1 }] }), []);
  assert.deepStrictEqual(cc.staleNames(names, { erro: 1 }), []);
});

test('código da página é JavaScript válido', () => {
  assert.doesNotThrow(() => new Function(`return ${cc.pageCode}`));
});
