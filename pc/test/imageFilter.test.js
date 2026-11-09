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

test('filtro de imagem: todo modo tem opção na tela, nome em PT e EN', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const dir = path.join(__dirname, '../src/renderer');
  const html = fs.readFileSync(path.join(dir, 'ui.html'), 'utf8');
  const js = fs.readFileSync(path.join(dir, 'ui.js'), 'utf8');
  const i18n = fs.readFileSync(path.join(dir, 'i18n.js'), 'utf8');
  for (const mode of imageFilter.MODE_IDS) {
    const m = html.match(new RegExp(`<option value="${mode}" data-t="(\\w+)">`));
    assert.ok(m, mode + ' sem opção em Configurações');
    assert.match(i18n, new RegExp(`\\b${m[1]}: '`), mode + ' sem nome em inglês');
    assert.match(js, new RegExp(`\\b${mode}: \\['`), mode + ' sem nome no botão da barra');
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
