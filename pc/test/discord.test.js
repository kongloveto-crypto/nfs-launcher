'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('net');
const os = require('os');
const path = require('path');
const { Presence, encodeFrame, decodeFrames, activityOf, OP } = require('../src/main/discord');
const { errorKind } = require('../src/main/connError');
const { GAME_IDS, GAMES } = require('../src/main/config');

const pipePath = (name) => (process.platform === 'win32' ? `\\\\?\\pipe\\${name}` : path.join(os.tmpdir(), `${name}.sock`));

test('Discord: quadro codificado e lido de volta, mesmo pela metade', () => {
  const a = encodeFrame(OP.FRAME, { evt: 'READY' });
  const b = encodeFrame(OP.PING, { x: 1 });
  const { frames, rest } = decodeFrames(Buffer.concat([a, b.subarray(0, 5)]));
  assert.deepEqual(frames, [{ op: OP.FRAME, data: { evt: 'READY' } }]);
  assert.equal(rest.length, 5);
  assert.deepEqual(decodeFrames(Buffer.concat([rest, b.subarray(5)])).frames, [{ op: OP.PING, data: { x: 1 } }]);
});

test('Discord: conversa com um canal local e envia só o nome do jogo e a hora', async () => {
  const name = `nfs-teste-${process.pid}`;
  const got = [];
  const finished = new Promise((resolve) => {
    const server = net.createServer((s) => {
      let buf = Buffer.alloc(0);
      s.on('error', () => {});
      s.on('data', (c) => {
        const r = decodeFrames(Buffer.concat([buf, c]));
        buf = r.rest;
        for (const f of r.frames) {
          got.push(f);
          if (f.op === OP.HANDSHAKE) s.write(encodeFrame(OP.FRAME, { evt: 'READY' }));
          else server.close(() => resolve());
        }
      });
      s.on('close', () => server.close(() => resolve()));
    });
    server.listen(pipePath(name), () => {
      const p = new Presence({ pipe: () => pipePath(name), pipes: 1, pid: 42 });
      p.set({ clientId: '123', details: 'NFSU2', title: 'Need for Speed: Underground 2', start: 1000 });
      setTimeout(() => p.set(null), 500);
    });
  });
  await finished;
  assert.deepEqual(got[0], { op: OP.HANDSHAKE, data: { v: 1, client_id: '123' } });
  assert.equal(got[1].data.cmd, 'SET_ACTIVITY');
  assert.equal(got[1].data.args.pid, 42);
  assert.deepEqual(got[1].data.args.activity, {
    details: 'NFSU2', timestamps: { start: 1000 },
    assets: { large_image: 'capa', large_text: 'Need for Speed: Underground 2' },
  });
});

test('Discord: botão de baixar leva à página de versões, com nome no limite do Discord', () => {
  const fs = require('fs');
  const FOLDER_URL = require('../src/main/github').RELEASES_URL;
  const a = activityOf({ clientId: '1', details: 'NFSU2', title: 'x', start: 1, linkLabel: 'Baixar', linkUrl: FOLDER_URL });
  assert.deepEqual(a.buttons, [{ label: 'Baixar', url: FOLDER_URL }]);
  const main = fs.readFileSync(path.join(__dirname, '../src/main/main.js'), 'utf8');
  const [, pt, en] = main.match(/linkLabel: tr\('(.+?)', '(.+?)'\), linkUrl: github\.RELEASES_URL/);
  assert.ok(pt.length <= 32 && en.length <= 32, 'o Discord recusa nome de botão com mais de 32 letras');
});

test('Discord fechado: não dá erro, espera e não insiste a cada mudança de tela', () => {
  let tries = 0;
  const p = new Presence({ pipes: 0, retryMs: 60000 });
  const orig = p.connect.bind(p);
  p.connect = (n) => { tries++; orig(n); };
  const want = { clientId: '1', details: 'x', start: 1 };
  p.set(want);
  p.set(want);
  p.set(want);
  assert.equal(tries, 1);
  p.set(null);
  assert.equal(p.timer, null, 'sair do jogo cancela a nova tentativa');
});

test('todo jogo do catálogo tem o campo do Discord', () => {
  for (const id of GAME_IDS) assert.match(GAMES[id].discordId, /^\d{17,20}$/, 'só o Application ID (números), nunca chave ou segredo');
});

test('tela de erro: cada falha vira um tipo de mensagem, sem código técnico', () => {
  assert.equal(errorKind(-106), 'offline');
  assert.equal(errorKind(-105), 'offline');
  assert.equal(errorKind(503), 'server');
  assert.equal(errorKind(-1), 'crash');
  assert.equal(errorKind(-102), 'other');
});
