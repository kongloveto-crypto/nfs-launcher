'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { toChromeUA } = require('../src/main/ua');

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.7977.130 Safari/537.36';
test('remove nome do app e Electron do User-Agent', () => {
  assert.equal(toChromeUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) NFSU2 Launcher/1.1.0 Chrome/152.0.7977.130 Electron/44.7.0 Safari/537.36'), CHROME);
  assert.equal(toChromeUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) NFS Launcher/1.7.0 Chrome/152.0.7977.130 Electron/44.7.0 Safari/537.36'), CHROME);
  assert.equal(toChromeUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) nfsu2-launcher/1.1.0 Chrome/152.0.7977.130 Electron/44.7.0 Safari/537.36'), CHROME);
});
test('UA do Chrome fica intacto', () => {
  assert.equal(toChromeUA(CHROME), CHROME);
});
