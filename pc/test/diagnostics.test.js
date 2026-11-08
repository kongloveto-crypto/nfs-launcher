'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { findIssues, formatReport, detectTools } = require('../src/main/diagnostics');

const base = () => ({
  when: '2026-10-29T12:00:00.000Z', app: '1.4.0', electron: '45.1.0', chrome: '156.0.8078.49',
  os: 'Windows 11 Pro (10.0.26300)', cpu: 'CPU · 16 threads', ramGB: 32,
  flags: { uncapped: false, noUi: false },
  settings: { highPriority: false, showCorner: true },
  window: { fullscreen: true },
  displays: [{ label: 'Monitor', hz: 240, scale: 1, pixels: '2560×1440', primary: true, current: true }],
  gpuFeatures: { webgpu: 'enabled' },
  gpuDevices: [{ vendorId: 0x10de, deviceId: 0x2684, active: true, driverVersion: '32.0.15.9999' }],
  gpuAux: { directComposition: true, nested: { x: 1 } },
  metrics: [{ type: 'GPU', cpu: 3.25, memMB: 400, priority: 'normal' }],
});

test('PC sem problemas conhecidos: nenhum ponto de atenção', () => {
  assert.deepEqual(findIssues(base()), []);
});
test('detecta --uncapped, prioridade alta e monitores com Hz diferentes', () => {
  const d = base();
  d.flags.uncapped = true;
  d.settings.highPriority = true;
  d.displays.push({ label: 'Outro', hz: 60, scale: 1, pixels: '1920×1080', primary: false, current: false });
  const txt = findIssues(d).join('\n');
  assert.match(txt, /uncapped/);
  assert.match(txt, /Prioridade/);
  assert.match(txt, /240 Hz \+ 60 Hz/);
});
test('avisa quando o relatório foi gerado sem o jogo aberto', () => {
  const d = base();
  d.window.jogoIniciado = false;
  assert.match(findIssues(d).join('\n'), /não estava aberto/);
});
test('detecta 144/165 Hz (fps = auto roda a 120)', () => {
  const d = base();
  d.displays[0].hz = 165;
  assert.match(findIssues(d).join('\n'), /165 Hz/);
});
test('detecta jogo na GPU integrada com placa dedicada presente', () => {
  const d = base();
  d.gpuDevices = [{ vendorId: 0x8086, active: true }, { vendorId: 0x10de, active: false }];
  assert.match(findIssues(d).join('\n'), /Alto desempenho/);
});
test('notebook na bateria, pouca memória e GPU sem driver', () => {
  const d = base();
  d.onBattery = true;
  d.ramGB = 4;
  d.gpuDevices = [{ vendorId: 0x1414, active: true }];
  const txt = findIssues(d).join('\n');
  assert.match(txt, /bateria/);
  assert.match(txt, /4 GB/);
  assert.match(txt, /Basic Render/);
});
test('WebGPU desligado: indica o programa de driver do fabricante certo', () => {
  for (const [id, name] of [[0x10de, 'NVIDIA App'], [0x1002, 'Adrenalin'], [0x8086, 'Intel Driver']]) {
    const d = base();
    d.gpuDevices = [{ vendorId: id, active: true }];
    d.gpuFeatures = { webgpu: 'disabled_software' };
    assert.match(findIssues(d).join('\n'), new RegExp(name), name);
  }
});
test('programas que misturam quadros: só os conhecidos são citados', () => {
  const found = detectTools(['explorer.exe', 'RTSS.exe', 'chrome.exe', 'LosslessScaling.exe', 'discord.exe']);
  assert.deepEqual(found.sort(), ['losslessscaling.exe', 'rtss.exe']);
  const d = base(); d.tools = found;
  const txt = findIssues(d).join('\n');
  assert.match(txt, /RivaTuner/);
  assert.match(txt, /Lossless/);
  assert.ok(!/chrome\.exe|discord|explorer/i.test(formatReport(d)), 'outros processos não aparecem');
});
test('relatório tem as seções e funciona sem dados da GPU', () => {
  const txt = formatReport(base());
  for (const s of ['Pontos de atenção', 'Versões', 'Monitores', 'GPU', 'Processos do app']) assert.ok(txt.includes(s), s);
  assert.match(txt, /2560×1440 a 240 Hz/);
  assert.match(txt, /directComposition/);
  assert.ok(!txt.includes('nested'), 'objetos aninhados ficam de fora');
  const d = base(); d.gpuDevices = []; d.gpuAux = null; d.metrics = []; d.displays = [];
  assert.doesNotThrow(() => formatReport(d));
});
