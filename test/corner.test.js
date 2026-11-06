'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { inTopZone } = require('../src/main/corner');
const b = { x: 100, y: 50, width: 1280, height: 720 }; // meio do topo: x = 740

test('aparece só com o cursor no meio do topo (o jogo não deixa o mouse ir aos cantos)', () => {
  assert.equal(inTopZone({ x: 740, y: 60 }, b), true);
  assert.equal(inTopZone({ x: 620, y: 130 }, b), true);
  assert.equal(inTopZone({ x: 1370, y: 60 }, b), false);  // canto superior direito: não mais
  assert.equal(inTopZone({ x: 740, y: 400 }, b), false);  // meio do jogo
  assert.equal(inTopZone({ x: 740, y: 20 }, b), false);   // acima da janela
  assert.equal(inTopZone(null, b), false);
});
