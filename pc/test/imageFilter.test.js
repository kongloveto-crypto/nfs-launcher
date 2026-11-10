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

test('filtro de imagem: todo modo só altera o canvas dos jogos (valores do motor no NFSU2, CSS filter nos outros)', () => {
  for (const mode of imageFilter.MODE_IDS) {
    for (const fxaa of [false, true]) {
      const css = imageFilter.css(true, mode, fxaa);
      assert.match(css, /^#game\{--nfs-image:[-\d. ]+\}#canvas\{(--nfs-image:[-\d. ]+;)?filter:[^{}]+\}$/);
      assert.doesNotMatch(css, /<script|javascript:|https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
      const nums = css.match(/^#game\{--nfs-image:([^}]+)\}/)[1].split(' ').map(Number);
      assert.equal(nums.length, 14, mode);
      assert.equal(nums[0], fxaa ? 1 : 0, 'o 1º número é o anti-serrilhado');
      imageFilter.FX_KEYS.forEach((k, i) => assert.ok(nums[i] >= imageFilter.RANGE[k][0] && nums[i] <= imageFilter.RANGE[k][1], `${mode}: ${k} fora do limite do motor`));
      assert.notEqual(nums.slice(1).join(' '), imageFilter.spec().split(' ').slice(1).join(' '), `${mode}: pacote sem efeito nenhum`);
    }
  }
});

test('pacote de imagem: os valores do motor repetem o filtro CSS antigo', () => {
  const v = (mode) => imageFilter.css(true, mode).match(/--nfs-image:([^}]+)\}/)[1];
  //                       fxaa nit sat vib con bri gama vin r g b bloom limiar sepia
  assert.equal(v('vivido'), '0 0 1.25 0 1.05 1 1 0 1 1 1 0 0.7 0');
  assert.equal(v('pretoBranco'), '0 0 0 0 1.15 1 1 0 1 1 1 0 0.7 0');
  assert.equal(v('porDoSol'), '0 0 1.3 0 1 1.05 1 0 1 1 1 0 0.7 0.25');
  assert.equal(v('neon'), '0 0.4 1.3 0.3 1.06 1 1 0 1 1 1 0.9 0.6 0');
  assert.equal(imageFilter.spec(), '0 0 1 0 1 1 1 0 1 1 1 0 0.7 0', 'neutro: o motor não roda nada');
  assert.equal(imageFilter.spec({ sat: 99, con: 'x', nit: -1 }), imageFilter.spec(), 'valor fora do limite volta ao neutro');
});

test('anti-serrilhado: vai sozinho quando o pacote está desligado; com os dois desligados, nada vai à página', () => {
  assert.equal(imageFilter.css(false, 'vivido', true), '#game{--nfs-image:1 0 1 0 1 1 1 0 1 1 1 0 0.7 0}#canvas{--nfs-image:1 0 1 0 1 1 1 0 1 1 1 0 0.7 0}');
  assert.equal(imageFilter.css(false, 'vivido', false), null);
  assert.equal(imageFilter.css(true, 'x', false), null);
  assert.match(imageFilter.css(true, 'x', true), /^#game\{--nfs-image:1 /);
  // Nos outros jogos (#canvas) a cor continua por CSS filter; pelo motor vai só o anti-serrilhado.
  assert.match(imageFilter.css(true, 'vivido', true), /#canvas\{--nfs-image:1 0 1 0 1 1 1 0 1 1 1 0 0\.7 0;filter:saturate\(1\.25\) contrast\(1\.05\)\}$/);
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
