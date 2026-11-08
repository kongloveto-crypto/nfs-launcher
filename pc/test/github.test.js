'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const gh = require('../src/main/github');
const dl = require('../src/main/downloader');

const REL = `https://github.com/${gh.REPO}/releases/download`;
const SHA = 'a'.repeat(64);

test('GitHub: só arquivos das releases deste repositório', () => {
  assert.ok(gh.okAsset(`${REL}/pc-3.0.3/NFS-Launcher-Setup-3.0.3.exe`, '.exe'));
  assert.ok(gh.okAsset(`${REL}/texturas-1/redux.pak`, '.pak'));
  assert.ok(!gh.okAsset(`${REL}/pc-3.0.3/NFS-Launcher-Setup-3.0.3.exe`, '.pak'), 'extensão errada');
  assert.ok(!gh.okAsset('https://github.com/outro/repo/releases/download/x/a.exe', '.exe'), 'outro repositório');
  assert.ok(!gh.okAsset(`http://github.com/${gh.REPO}/releases/download/x/a.exe`, '.exe'), 'sem https');
  assert.ok(!gh.okAsset(`https://github.com.evil.example/${gh.REPO}/releases/download/x/a.exe`, '.exe'));
  assert.ok(!gh.okAsset(`${REL}/x/a.exe?b=1`, '.exe'));
  assert.ok(!gh.okAsset(`${REL}/x/..%5Ca.exe`, '.exe'));
  assert.ok(gh.UPDATE_URL.startsWith(`https://raw.githubusercontent.com/${gh.REPO}/main/pc/`));
  assert.ok(gh.TEXTURES_URL.startsWith(`https://raw.githubusercontent.com/${gh.REPO}/main/pc/`));
});

test('GitHub: versão nova só se for maior e com arquivo, tamanho e SHA-256 válidos', () => {
  const ok = { versao: '3.0.4', arquivo: `${REL}/pc-3.0.4/NFS-Launcher-Setup-3.0.4.exe`, tamanho: 100, sha256: SHA.toUpperCase(), novidades: { pt: 'oi', en: 'hi' } };
  const u = gh.newerApp(ok, '3.0.3');
  assert.equal(u.version, '3.0.4');
  assert.equal(u.sha256, SHA);
  assert.deepEqual(u.notes, { pt: 'oi', en: 'hi' });
  assert.equal(gh.newerApp(ok, '3.0.4'), null, 'mesma versão');
  assert.equal(gh.newerApp(ok, '3.1.0'), null, 'mais antiga');
  assert.equal(gh.newerApp({ ...ok, versao: '3.10.0' }, '3.9.9').version, '3.10.0');
  assert.equal(gh.newerApp({ ...ok, sha256: 'x' }, '3.0.3'), null);
  assert.equal(gh.newerApp({ ...ok, tamanho: 0 }, '3.0.3'), null);
  assert.equal(gh.newerApp({ ...ok, arquivo: 'https://evil.example/a.exe' }, '3.0.3'), null);
  assert.equal(gh.newerApp(null, '3.0.3'), null);
});

test('GitHub: lista de texturas só com ids conhecidos, um de cada', () => {
  const f = (id, extra = {}) => ({ id, arquivo: `${REL}/texturas-1/${id}.pak`, tamanho: 10, sha256: SHA, ...extra });
  const l = gh.texturesList({ arquivos: [f('site'), f('redux'), f('redux', { tamanho: 99 }), f('outro'), f('nextgen', { sha256: '1' })] }, ['site', 'redux', 'nextgen']);
  assert.deepEqual(Object.keys(l), ['site', 'redux']);
  assert.equal(l.redux.size, 10, 'o primeiro vale');
  assert.deepEqual(gh.texturesList({}, ['site']), {});
});

// fetch falso: entrega `data`, com Range se pedido (cut = corta a conexão depois de N bytes).
function fakeFetch(data, { cut = Infinity, status } = {}) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push(init.headers.range || null);
    const m = /bytes=(\d+)-/.exec(init.headers.range || '');
    const from = m ? Number(m[1]) : 0;
    const body = data.subarray(from, Math.min(data.length, from + cut));
    let sent = false;
    return {
      status: status || (m ? 206 : 200),
      body: { getReader: () => ({ read: async () => {
        if (sent) { if (body.length < data.length - from) throw Object.assign(new Error('conexão caiu'), { name: 'TypeError' }); return { done: true }; }
        sent = true; return { done: false, value: body };
      } }) },
    };
  };
  fn.calls = calls;
  return fn;
}

test('download: confere o SHA-256, continua de onde parou e guarda o SHA ao lado', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-'));
  const data = crypto.randomBytes(5000);
  const sha256 = crypto.createHash('sha256').update(data).digest('hex');
  const dest = path.join(dir, 'redux.pak');
  await assert.rejects(dl.download({ url: 'u', dest, size: data.length, sha256, fetch: fakeFetch(data, { cut: 2000 }) }));
  assert.equal(fs.statSync(dl.partOf(dest)).size, 2000, 'a parte fica para continuar');
  const f = fakeFetch(data);
  await dl.download({ url: 'u', dest, size: data.length, sha256, fetch: f });
  assert.deepEqual(f.calls, ['bytes=2000-']);
  assert.ok(fs.readFileSync(dest).equals(data));
  assert.ok(!fs.existsSync(dl.partOf(dest)));
  assert.equal(dl.savedSha(dest), sha256);
});

test('download: arquivo diferente do publicado não fica no disco', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-'));
  const data = crypto.randomBytes(1000);
  const dest = path.join(dir, 'x.exe');
  await assert.rejects(dl.download({ url: 'u', dest, size: 1000, sha256: SHA, fetch: fakeFetch(data) }), (e) => e.code === 'sha');
  assert.ok(!fs.existsSync(dest) && !fs.existsSync(dl.partOf(dest)));
  await assert.rejects(dl.download({ url: 'u', dest, size: 500, sha256: SHA, fetch: fakeFetch(data) }), (e) => e.code === 'size');
  await assert.rejects(dl.download({ url: 'u', dest, size: 1000, sha256: SHA, fetch: fakeFetch(data, { status: 404 }) }), (e) => e.code === 'http');
  assert.equal(dl.savedSha(dest), null);
});
