'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../src/main/combo');

test('fromEvent: ordem canônica e teclas', () => {
  assert.equal(c.fromEvent({ code: 'KeyP', control: true, alt: true, shift: true }), 'Ctrl+Alt+Shift+P');
  assert.equal(c.fromEvent({ code: 'KeyF', ctrlKey: true, altKey: true }), 'Ctrl+Alt+F');
  assert.equal(c.fromEvent({ code: 'F11' }), 'F11');
  assert.equal(c.fromEvent({ code: 'Digit5', control: true }), 'Ctrl+5');
  assert.equal(c.fromEvent({ code: 'ControlLeft', control: true }), null);
});
test('validate: aceita combinações seguras', () => {
  for (const ok of ['Ctrl+Alt+F', 'Ctrl+Alt+Shift+P', 'Alt+F7', 'Ctrl+F', 'Ctrl+Shift+F', 'Ctrl+Alt+Shift+W']) assert.ok(c.validate(ok).ok, ok);
});
test('validate: teclas do jogo só com Ctrl+Alt+Shift (marcha/nitro não disparam atalho)', () => {
  for (const bad of ['Ctrl+D', 'Alt+A', 'Ctrl+Shift+W', 'Alt+Up', 'Ctrl+Alt+C', 'Alt+F9', 'Ctrl+1', 'Alt+Shift+Space']) {
    const r = c.validate(bad);
    assert.equal(r.ok, false, bad);
    assert.match(r.reason, /tecla do jogo/, bad);
  }
});
test('validate: rejeita combinações perigosas ou malformadas', () => {
  for (const bad of ['F11', 'Shift+P', 'P', 'Alt+F4', 'Ctrl+W', 'Alt+Space', 'Alt+Tab', 'Win+P', 'Ctrl+Win+P',
    'Ctrl+Ctrl+P', 'Alt+Ctrl+P', '', null, undefined, 'Ctrl+Alt+Foo', 'Ctrl+Alt+O']) {
    assert.equal(c.validate(bad).ok, false, `deveria rejeitar: ${bad}`);
  }
});
test('toAccelerator', () => {
  assert.equal(c.toAccelerator('Ctrl+Alt+Shift+P'), 'Control+Alt+Shift+P');
  assert.equal(c.toAccelerator('Alt+F9'), 'Alt+F9');
});
