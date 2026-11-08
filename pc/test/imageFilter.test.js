'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const imageFilter = require('../src/main/imageFilter');
const settings = require('../src/main/settings');

test('filtro de imagem: desligado por padrão, sem CSS', () => {
  const d = settings.sanitize({});
  assert.equal(d.imageFilter, true);
  assert.ok(imageFilter.css(d.imageFilter, d.imageMode), 'ligado por padrão (pedido do Bruno, 08/11)');
  assert.equal(imageFilter.css(false, d.imageMode), null);
});

test('filtro de imagem: todo modo só altera o canvas dos dois jogos', () => {
  for (const mode of imageFilter.MODE_IDS) {
    const css = imageFilter.css(true, mode);
    assert.match(css, /^#game,#canvas\{filter:[^{}]+\}$/);
    assert.doesNotMatch(css, /<script|javascript:|https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
  }
});

test('filtro de imagem: o botão passa por todos os modos e termina desligado', () => {
  let s = { on: false, mode: 'intenso' };
  const vistos = [];
  for (let i = 0; i <= imageFilter.MODE_IDS.length; i++) {
    s = imageFilter.next(s.on, s.mode);
    vistos.push(s.on ? s.mode : 'desligado');
  }
  assert.deepEqual(vistos, [...imageFilter.MODE_IDS, 'desligado']);
  assert.deepEqual(imageFilter.next(true, 'x'), { on: true, mode: imageFilter.MODE_IDS[0] });
});

test('filtro de imagem: modo desconhecido não gera CSS nem é aceito', () => {
  assert.equal(imageFilter.css(true, 'constructor'), null);
  assert.equal(imageFilter.css(true, 'x'), null);
  const d = settings.sanitize({ imageMode: 'x' });
  assert.equal(d.imageMode, settings.DEFAULTS.imageMode);
  assert.equal(settings.applyChange(d, 'imageMode', 'x').ok, false);
  assert.equal(settings.applyChange(d, 'imageMode', 'intenso').cfg.imageMode, 'intenso');
  assert.equal(settings.applyChange(d, 'imageFilter', true).cfg.imageFilter, true);
});
