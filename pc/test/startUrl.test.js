'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { GAMES, startUrlOf, CREW_MAX } = require('../src/main/config');
const settings = require('../src/main/settings');

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

test('convite da equipe no máximo 2 vezes; depois, endereço normal', () => {
  assert.strictEqual(CREW_MAX, 2);
  assert.strictEqual(startUrlOf('nfsu2', 'pt', 0), 'https://nfsu2.xyz/#crew=U2BR');
  assert.strictEqual(startUrlOf('nfsu2', 'pt', 1), 'https://nfsu2.xyz/#crew=U2BR');
  assert.strictEqual(startUrlOf('nfsu2', 'pt', 2), GAMES.nfsu2.url);
  assert.strictEqual(startUrlOf('nfsu2', 'pt', 50), GAMES.nfsu2.url);
});

test('contador de convites: começa em 0 e só aceita inteiro', () => {
  assert.strictEqual(settings.sanitize({}).crewInvites, 0);
  assert.strictEqual(settings.sanitize({ crewInvites: 2 }).crewInvites, 2);
  assert.strictEqual(settings.sanitize({ crewInvites: -1 }).crewInvites, 0);
  assert.strictEqual(settings.sanitize({ crewInvites: '5' }).crewInvites, 0);
  assert.strictEqual(settings.sanitize({ crewInvites: 1.5 }).crewInvites, 0);
});
