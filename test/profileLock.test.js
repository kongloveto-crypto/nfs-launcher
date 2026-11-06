'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { acquire } = require('../src/main/profileLock');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nfs-trava-'));
let n = 0;
const fresh = () => path.join(tmp, `${++n}.pid`);
// Outro processo deste mesmo programa, como uma cópia antiga do app ainda fechando.
const copy = (lifeMs) => new Promise((res) => {
  const c = spawn(process.execPath, ['-e', `console.log('ok');setTimeout(()=>process.exit(0),${lifeMs})`], { stdio: ['ignore', 'pipe', 'ignore'] });
  c.stdout.once('data', () => res(c));
});

test('sem cópia antiga: abre na hora e anota o número do processo', async () => {
  const pidFile = fresh();
  assert.equal(await acquire({ pidFile }), true);
  assert.equal(fs.readFileSync(pidFile, 'utf8'), String(process.pid));
});
test('cópia antiga que já saiu ou arquivo estranho: abre na hora', async () => {
  const c = await copy(0);
  await new Promise((r) => c.once('exit', r));
  for (const text of [String(c.pid), 'lixo', '-5', '']) {
    const pidFile = fresh();
    fs.writeFileSync(pidFile, text);
    const t = Date.now();
    assert.equal(await acquire({ pidFile }), true, text);
    assert.ok(Date.now() - t < 3000, text);
  }
});
test('número reaproveitado por outro programa: não espera nem encerra', async () => {
  const other = spawn('cmd.exe', ['/c', 'ping -n 30 127.0.0.1 >nul'], { stdio: 'ignore', windowsHide: true });
  const pidFile = fresh();
  fs.writeFileSync(pidFile, String(other.pid));
  let killed = false;
  assert.equal(await acquire({ pidFile, killAfterMs: 0, giveUpMs: 100, kill: () => { killed = true; } }), true);
  assert.equal(killed, false);
  other.kill();
});
test('cópia antiga ainda fechando: espera ela sair, sem encerrar', async () => {
  const c = await copy(800);
  let code = null;
  c.once('exit', (x) => { code = x; });
  const pidFile = fresh();
  fs.writeFileSync(pidFile, String(c.pid));
  assert.equal(await acquire({ pidFile, stepMs: 20 }), true);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(code, 0, 'a cópia antiga saiu sozinha');
});
test('cópia antiga travada: é encerrada no limite e aí abre', async () => {
  const c = await copy(60000);
  const pidFile = fresh();
  fs.writeFileSync(pidFile, String(c.pid));
  assert.equal(await acquire({ pidFile, killAfterMs: 300, giveUpMs: 20000, stepMs: 20 }), true);
  await new Promise((r) => setTimeout(r, 50));
  assert.notEqual(c.exitCode, 0);
});
test('cópia antiga que não encerra: não abre os dados', async () => {
  const c = await copy(60000);
  const pidFile = fresh();
  fs.writeFileSync(pidFile, String(c.pid));
  assert.equal(await acquire({ pidFile, killAfterMs: 10, giveUpMs: 200, stepMs: 10, kill: () => {} }), false);
  assert.equal(fs.readFileSync(pidFile, 'utf8'), String(c.pid), 'o arquivo continua apontando para a cópia antiga');
  c.kill();
});
test('nunca espera o próprio processo', async () => {
  const pidFile = fresh();
  fs.writeFileSync(pidFile, String(process.pid));
  assert.equal(await acquire({ pidFile, killAfterMs: 0, giveUpMs: 0 }), true);
});
