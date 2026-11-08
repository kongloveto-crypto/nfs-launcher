'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { GAMES, startUrlOf } = require('../src/main/config');

test('START em português abre o convite da equipe', () => {
  assert.strictEqual(startUrlOf('nfsu2', 'pt'), 'https://nfsu2.xyz/#crew=U2BR');
});

test('START em inglês abre o endereço normal, sem convite', () => {
  assert.strictEqual(startUrlOf('nfsu2', 'en'), GAMES.nfsu2.url);
  assert.ok(!startUrlOf('nfsu2', 'en').includes('#'));
});

test('jogo sem convite abre o endereço normal nos dois idiomas', () => {
  assert.strictEqual(startUrlOf('nfsmw', 'pt'), GAMES.nfsmw.url);
  assert.strictEqual(startUrlOf('nfsmw', 'en'), GAMES.nfsmw.url);
  assert.strictEqual(startUrlOf('nfsc', 'pt'), 'https://nfscrb.xyz');
  assert.strictEqual(startUrlOf('nfsc', 'en'), 'https://nfscrb.xyz');
});
