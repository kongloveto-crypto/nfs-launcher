'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { decide } = require('../src/main/gpuFallback');
const s = require('../src/main/settings');

const base = { supported: false, software: false, unblockOn: false, tried: false, safeMode: false, gameStarted: false };

test('sem placa e sem tentativa anterior: tenta o DirectX 11', () => {
  assert.equal(decide(base), 'try');
});

test('placa funcionando: não muda nada', () => {
  assert.equal(decide({ ...base, supported: true }), 'none');
  assert.equal(decide({ ...base, supported: true, unblockOn: true, tried: true }), 'none');
});

test('tenta sozinho uma vez só: nunca entra em ciclo de reabrir', () => {
  assert.equal(decide({ ...base, tried: true }), 'none');
});

test('DirectX 11 sem placa, ou só em software: desliga', () => {
  assert.equal(decide({ ...base, unblockOn: true, tried: true }), 'failed');
  assert.equal(decide({ ...base, supported: true, software: true, unblockOn: true, tried: true }), 'failed');
});

test('nunca reabre com o jogo aberto nem no modo seguro', () => {
  assert.equal(decide({ ...base, gameStarted: true }), 'none');
  assert.equal(decide({ ...base, safeMode: true }), 'none');
});

test('configuração: desligado por padrão e a tentativa fica guardada', () => {
  assert.equal(s.DEFAULTS.unblockGpu, false);
  assert.equal(s.DEFAULTS.unblockTried, false);
  assert.equal(s.sanitize({ unblockTried: true }).unblockTried, true);
  assert.equal(s.applyChange(s.DEFAULTS, 'unblockTried', true).ok, false);
});
