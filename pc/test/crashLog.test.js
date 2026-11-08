'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crashLog = require('../src/main/crashLog');
const { findIssues, formatReport } = require('../src/main/diagnostics');

const NOW = Date.parse('2026-11-08T20:00:00.000Z');
const e = (kind, reason, ago = 3600e3, extra = {}) => crashLog.entry({ kind, reason, when: NOW - ago, ...extra });

test('guarda só as últimas e ignora entradas estragadas', () => {
  let list = [{ lixo: 1 }];
  for (let i = 0; i < crashLog.MAX + 5; i++) list = crashLog.add(list, e('jogo', 'crashed', i * 1000));
  assert.equal(list.length, crashLog.MAX);
  assert.ok(list.every((x) => typeof x.when === 'string'));
});

test('entrada sem dados pessoais: só tipo, motivo, código, jogo, modo e minutos', () => {
  const x = crashLog.entry({ kind: 'GPU', reason: 'crashed', exitCode: -1073741819, game: 'nfsu2', dx11: true, playedMs: 125000, when: NOW });
  assert.deepEqual(Object.keys(x).sort(), ['dx11', 'exitCode', 'game', 'kind', 'playedMin', 'reason', 'when']);
  assert.equal(x.playedMin, 2);
});

test('pontos de atenção: GPU repetida, memória, rede e jogo; quedas antigas não contam', () => {
  const list = [e('GPU', 'crashed'), e('GPU', 'crashed'), e('jogo', 'oom'), e('rede', 'crashed'),
    e('jogo', 'crashed'), e('jogo', 'crashed'), e('GPU', 'crashed', 10 * 24 * 3600e3)];
  const txt = crashLog.issues(list, { now: NOW, driver: 'NVIDIA App' }).join('\n');
  assert.match(txt, /placa de vídeo caiu 2 vezes.*NVIDIA App/);
  assert.match(txt, /Faltou memória 1 vez/);
  assert.match(txt, /rede do app caiu 1 vez/);
  assert.match(txt, /O jogo caiu 2 vezes/);
  assert.deepEqual(crashLog.issues([e('GPU', 'crashed')], { now: NOW }), []); // uma queda só não vira aviso
});

test('relatório mostra a seção de quedas, mais nova primeiro', () => {
  const d = {
    when: new Date(NOW).toISOString(), crashes: [e('jogo', 'crashed', 7200e3, { game: 'nfsu2' }), e('GPU', 'oom', 60e3, { dx11: true })],
    gpuDevices: [{ vendorId: 0x10de, active: true }],
  };
  const r = formatReport(d);
  assert.match(r, /== Quedas recentes/);
  assert.ok(r.indexOf('faltou memória') < r.indexOf('falha do motor'));
  assert.match(r, /DirectX 11/);
  assert.match(findIssues(d).join('\n'), /Faltou memória/);
  assert.match(formatReport({ when: d.when }), /Nenhuma queda registrada/);
});

test('arquivo: grava e lê; arquivo estragado vira lista vazia', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quedas-'));
  const f = path.join(dir, 'quedas.json');
  assert.deepEqual(crashLog.load(f), []);
  assert.ok(crashLog.save(f, [e('jogo', 'crashed')]));
  assert.equal(crashLog.load(f).length, 1);
  fs.writeFileSync(f, '{estragado');
  assert.deepEqual(crashLog.load(f), []);
  fs.rmSync(dir, { recursive: true, force: true });
});
