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

test('aceita os instaladores com e sem texturas', () => {
  const html = '<div>NFS-Launcher-Setup-2.0.7-sem-texturas.exe</div><div>NFS-Launcher-Setup-3.0.1-com-texturas.exe</div>';
  assert.deepStrictEqual(update.versionsIn(html), ['2.0.7', '3.0.1']);
  assert.strictEqual(update.newer(html, '3.0.0'), '3.0.1');
  assert.strictEqual(update.newer(html, '3.0.1'), null);
  // Cada linha só vê a própria: o leve (2.x) não é mandado ao com texturas, nem o contrário.
  const pasta = '<div>NFS-Launcher-Setup-2.0.9-sem-texturas.exe</div><div>NFS-Launcher-Setup-3.0.5-com-texturas.exe</div><div>NFS-Launcher-Setup-2.0.8.exe</div><div>NFS-Launcher-Setup-3.0.2.exe</div>';
  assert.strictEqual(update.newer(pasta, '2.0.8'), '2.0.9');
  assert.strictEqual(update.newer(pasta, '3.0.2'), '3.0.5');
  assert.strictEqual(update.newer('<div>NFS-Launcher-Setup-3.0.2.exe</div>', '2.0.8'), null);
  assert.strictEqual(update.newer('<div>NFS-Launcher-Setup-2.0.9.exe</div>', '3.0.1'), null);
  assert.strictEqual(update.newer('<div>NFS-Launcher-Setup-4.0.0-sem-texturas.exe</div>', '2.0.8'), '4.0.0');
  assert.deepStrictEqual(update.versionsIn('<div>NFS-Launcher-Setup-3.0.1-.exe</div><div>NFS-Launcher-Setup-3.0.1.exe.txt</div>'), ['3.0.1']);
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
