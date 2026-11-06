'use strict';
const test = require('node:test');
const assert = require('node:assert');
const update = require('../src/main/update');

test('compara versões número a número', () => {
  assert.strictEqual(update.compare('1.8.0', '1.7.2'), 1);
  assert.strictEqual(update.compare('1.7.10', '1.7.9'), 1);
  assert.strictEqual(update.compare('1.7.2', '1.7.2'), 0);
  assert.strictEqual(update.compare('1.7.2', '2.0.0'), -1);
  assert.strictEqual(update.compare('x', '1.0.0'), 0);
});

test('lê só os instaladores da lista da pasta e acha a versão nova', () => {
  const html = '<div class="flip-entry-title">NFS-Launcher-Android-1.2.1.apk</div>' +
    '<div class="flip-entry-title">NFS-Launcher-Setup-1.7.2.exe</div><div>NFS-Launcher-Setup-1.9.0.exe</div>';
  assert.deepStrictEqual(update.versionsIn(html), ['1.7.2', '1.9.0']);
  assert.strictEqual(update.newer(html, '1.8.0'), '1.9.0');
  assert.strictEqual(update.newer(html, '1.9.0'), null);
  assert.strictEqual(update.newer('<html>pasta vazia</html>', '1.8.0'), null);
});

test('o APK de Android nunca conta como atualização do PC', () => {
  const soAndroid = '<div>NFS-Launcher-Android-9.9.9.apk</div><div>NFS-Launcher-Android-9.9.9.apk.idsig</div>';
  assert.deepStrictEqual(update.versionsIn(soAndroid), []);
  assert.strictEqual(update.newer(soAndroid, '1.8.2'), null);
  const pasta = '<div>NFS-Launcher-Android-9.9.9.apk</div><div>NFS-Launcher-Setup-1.8.0.exe</div>';
  assert.strictEqual(update.newer(pasta, '1.8.2'), null);
  assert.strictEqual(update.newer(pasta, '1.7.0'), '1.8.0');
});

test('endereços fixos da pasta do Drive (https)', () => {
  assert.match(update.FOLDER_URL, /^https:\/\/drive\.google\.com\/drive\/folders\/[\w-]+$/);
  assert.match(update.LIST_URL, /^https:\/\/drive\.google\.com\/embeddedfolderview\?id=[\w-]+$/);
});
