'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { allowPermission } = require('../src/main/permissions');

test('permissões que o jogo precisa são liberadas', () => {
  for (const p of ['fullscreen', 'pointerLock', 'keyboardLock', 'clipboard-sanitized-write', 'persistent-storage']) {
    assert.equal(allowPermission(p, {}), true, p);
  }
});
test('pasta de músicas: só leitura', () => {
  assert.equal(allowPermission('fileSystem', { fileAccessType: 'readable', isDirectory: true }), true);
  assert.equal(allowPermission('fileSystem', { fileAccessType: 'writable', isDirectory: true }), false);
  assert.equal(allowPermission('fileSystem', {}), false);
  assert.equal(allowPermission('fileSystem', undefined), false);
});
test('demais permissões continuam negadas', () => {
  for (const p of ['media', 'geolocation', 'notifications', 'hid', 'usb', 'serial', 'display-capture',
    'clipboard-read', 'openExternal', 'midiSysex', 'unknown']) {
    assert.equal(allowPermission(p, { fileAccessType: 'readable' }), false, p);
  }
});
