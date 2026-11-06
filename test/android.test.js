'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const motor = (...p) => fs.readFileSync(path.join(__dirname, '../android-motor', ...p), 'utf8');
const main = motor('app/java/xyz/nfs/launcher/MainActivity.java');

test('celular: o aviso de versão nova só olha o APK, e o do PC só olha o instalador', () => {
  const pattern = main.match(/APK_NAME = Pattern\.compile\("(.+?)"\)/)[1].replace(/\\\\/g, '\\');
  const re = new RegExp(pattern);
  assert.ok(re.test('NFS-Launcher-Android-1.5.1.apk'));
  assert.ok(!re.test('NFS-Launcher-Setup-9.9.9.exe'), 'o instalador do PC nunca conta no celular');
  const { versionsIn } = require('../src/main/update');
  assert.deepEqual(versionsIn('NFS-Launcher-Android-9.9.9.apk'), [], 'o APK nunca conta no PC');
});

test('celular: mesma pasta de versões do PC', () => {
  const { FOLDER_URL, LIST_URL } = require('../src/main/update');
  const id = main.match(/FOLDER_ID = "(.+?)"/)[1];
  assert.ok(FOLDER_URL.endsWith(id));
  assert.ok(LIST_URL.endsWith(id));
});

test('celular: tipos de erro iguais aos do PC, sem código técnico na tela', () => {
  const { errorKind } = require('../src/main/connError');
  const expected = (code) => errorKind(code);
  // A mesma lista de códigos de "sem internet" nos dois apps.
  for (const code of [-21, -105, -106, -109, -137]) {
    assert.equal(expected(code), 'offline');
    assert.match(main, new RegExp(`code == ${code}\\b`));
  }
  const home = motor('app/assets/home.js');
  assert.doesNotMatch(home, /ERR_|errorCode/);
});

test('celular: arquivos que a tela usa entram no APK', () => {
  const setup = motor('app/setup.py');
  for (const name of ['sounds.js', 'tips.js', 'icon.png']) assert.ok(setup.includes(`'${name}'`), name);
  assert.ok(setup.includes("renderer / 'bg'"), 'fundos');
  const html = motor('app/assets/home.html');
  assert.ok(html.includes('src="sounds.js"'));
  assert.match(html, /img-src 'self' data:/, 'imagens próprias do jogador');
});

test('celular: patches com recarga sem cache, tela de carregar, erro e WebGPU nos chips bloqueados', () => {
  const p6 = motor('patches/0006-um-jogo-por-vez-e-nada-em-segundo-plano.patch');
  for (const s of ['reloadIgnoringCache', 'nfsShowLoading', 'nfsFail']) assert.ok(p6.includes(s), s);
  const p5 = motor('patches/0005-app-unico-e-leve.patch');
  assert.ok(p5.includes('--disable-dawn-features=adapter_blocklist'));
  assert.ok(p5.includes('prepareGame'));
  assert.ok(!p5.includes('SkiaGraphite') && !p5.includes('skip_validation'), 'desempenho do celular só muda se o Bruno pedir');
  assert.ok(!p5.includes('enable-unsafe-webgpu'), 'só a lista de chips, nunca a opção insegura inteira');
});

test('celular: sem doação, tela inicial e sons sempre ligados, igual ao PC', () => {
  const all = motor('app/assets/home.js') + motor('app/assets/home.html') + motor('app/assets/home.css') + main + motor('app/java/xyz/nfs/launcher/GuideView.java');
  assert.doesNotMatch(all, /donate|doação|\bPIX\b|PAYPAL/i);
  assert.doesNotMatch(all, /s-showHome|s-sounds/);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '../scripts/export-guides.js'), 'utf8'), /DONATE/);
});

test('celular: DNS seguro na mesma ordem do PC, só em falha de conexão', () => {
  const { SECURE_DNS } = require('../src/main/config');
  const { offersSecureDns } = require('../src/main/connError');
  const script = motor('make-patches.py');
  assert.equal(main.match(/DNS_FIRST = "(.+?)"/)[1], Object.keys(SECURE_DNS)[0]);
  assert.equal(main.match(/DNS_SECOND = "(.+?)"/)[1], Object.keys(SECURE_DNS)[1]);
  for (const id of Object.keys(SECURE_DNS)) assert.ok(script.includes(SECURE_DNS[id].join(' ')), id);
  for (const kind of ['offline', 'other', 'server', 'crash']) assert.equal(new RegExp(`"${kind}"\\.equals\\(kind\\)`).test(main), offersSecureDns(kind), kind);
});

test('celular: nada de mapa, endereço de site ou Game Turbo na tela inicial', () => {
  const home = motor('app/assets/home.js') + motor('app/assets/home.html');
  assert.doesNotMatch(home, /nfsu2\.xyz|nfsmwo\.com|Game Turbo|Dicas e mapa/);
});
