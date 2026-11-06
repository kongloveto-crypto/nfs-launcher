'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const custom = require('../src/main/custom');

test('arquivo só para jogo e tipo conhecidos (sem caminhos vindos de fora)', () => {
  assert.strictEqual(custom.fileFor('C:\\d', 'nfsu2', 'bg'), path.join('C:\\d', 'nfsu2-bg.jpg'));
  assert.strictEqual(custom.fileFor('C:\\d', 'nfsmw', 'disc'), path.join('C:\\d', 'nfsmw-disc.png'));
  for (const [g, k] of [['..\\x', 'bg'], ['nfsu2', 'toString'], ['nfsu2', '../bg'], ['', 'bg']]) assert.strictEqual(custom.fileFor('C:\\d', g, k), null);
});

test('fundo cabe em 2560×1440 sem aumentar imagens pequenas', () => {
  assert.deepStrictEqual(custom.fitWithin(5120, 2880, 2560, 1440), { width: 2560, height: 1440 });
  assert.deepStrictEqual(custom.fitWithin(4000, 1000, 2560, 1440), { width: 2560, height: 640 });
  assert.deepStrictEqual(custom.fitWithin(800, 600, 2560, 1440), { width: 800, height: 600 });
});

test('capa: quadrado do centro', () => {
  assert.deepStrictEqual(custom.squareCrop(1268, 1226), { x: 21, y: 0, width: 1226, height: 1226 });
  assert.deepStrictEqual(custom.squareCrop(300, 500), { x: 0, y: 100, width: 300, height: 300 });
});

test('formatos aceitos', () => {
  assert.ok(custom.extOk('C:\\a\\capa.PNG') && custom.extOk('x.jpeg') && custom.extOk('x.jpg'));
  assert.ok(!custom.extOk('x.exe') && !custom.extOk('x.webp') && !custom.extOk('png'));
});
