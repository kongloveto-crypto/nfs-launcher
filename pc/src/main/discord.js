'use strict';
// Discord: mostra "Jogando NFS Launcher" no perfil do jogador, com o jogo aberto na linha de baixo. Conversa só com o Discord aberto no próprio PC, por um canal
// local (pipe), sem internet e sem biblioteca externa. Envia só o nome do jogo, a hora em que ele começou e o botão de baixar.
const net = require('net');

const OP = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 };
const RETRY_MS = 30000;
const pipeName = (n) => `\\\\?\\pipe\\discord-ipc-${n}`;

function encodeFrame(op, data) {
  const body = Buffer.from(JSON.stringify(data), 'utf8');
  const head = Buffer.alloc(8);
  head.writeInt32LE(op, 0);
  head.writeInt32LE(body.length, 4);
  return Buffer.concat([head, body]);
}
// Separa os quadros completos; o que sobrar fica em `rest`, à espera do resto.
function decodeFrames(buf) {
  const frames = [];
  let at = 0;
  while (buf.length - at >= 8) {
    const op = buf.readInt32LE(at);
    const len = buf.readInt32LE(at + 4);
    if (buf.length - at - 8 < len) break;
    let data = null;
    try { data = JSON.parse(buf.toString('utf8', at + 8, at + 8 + len)); } catch { /* quadro ilegível: ignora */ }
    frames.push({ op, data });
    at += 8 + len;
  }
  return { frames, rest: buf.subarray(at) };
}
function activityOf(w) {
  const activity = {
    details: w.details,
    timestamps: { start: w.start },
    assets: { large_image: 'capa', large_text: w.title }, // sem imagem "capa" no app do Discord, ele só não mostra
  };
  if (w.linkUrl) activity.buttons = [{ label: w.linkLabel, url: w.linkUrl }]; // quem vê o perfil clica; o próprio jogador não
  return activity;
}

// set({ clientId, details, start, linkLabel, linkUrl }) mostra o jogo; set(null) fecha o canal e o Discord tira do perfil.
class Presence {
  constructor({ pipe = pipeName, pipes = 10, retryMs = RETRY_MS, pid = process.pid } = {}) {
    Object.assign(this, { pipe, pipes, retryMs, pid });
    this.want = null;
    this.sock = null;
    this.ready = false;
    this.timer = null;
    this.nonce = 0;
  }
  set(want) {
    const was = this.want;
    this.want = want;
    if (!want) { this.close(); return; }
    if (was && was.clientId !== want.clientId) this.close(); // cada jogo tem o próprio app no Discord
    if (this.ready) { if (!was || was.details !== want.details || was.start !== want.start || was.linkLabel !== want.linkLabel) this.send(); return; }
    if (!this.sock && !this.timer) this.connect(0);
  }
  close() {
    clearTimeout(this.timer);
    this.timer = null;
    this.ready = false;
    if (this.sock) { const s = this.sock; this.sock = null; s.removeAllListeners(); s.on('error', () => {}); s.destroy(); }
  }
  retry() {
    this.close();
    // Discord fechado: tenta de novo com calma.
    if (this.want) this.timer = setTimeout(() => { this.timer = null; this.connect(0); }, this.retryMs);
  }
  connect(n) {
    if (!this.want) return;
    if (n >= this.pipes) { this.retry(); return; }
    const s = net.connect(this.pipe(n));
    this.sock = s;
    let buf = Buffer.alloc(0);
    s.once('error', () => { if (this.sock !== s) return; this.sock = null; s.destroy(); this.connect(n + 1); });
    s.once('connect', () => {
      s.removeAllListeners('error');
      s.on('error', () => { if (this.sock === s) this.retry(); });
      s.on('close', () => { if (this.sock === s) this.retry(); });
      s.write(encodeFrame(OP.HANDSHAKE, { v: 1, client_id: this.want.clientId }));
    });
    s.on('data', (chunk) => {
      const { frames, rest } = decodeFrames(Buffer.concat([buf, chunk]));
      buf = rest;
      for (const f of frames) this.onFrame(s, f);
    });
  }
  onFrame(s, f) {
    if (f.op === OP.PING) { s.write(encodeFrame(OP.PONG, f.data)); return; }
    if (f.op === OP.CLOSE) { this.retry(); return; }
    if (f.op === OP.FRAME && f.data && f.data.evt === 'READY') { this.ready = true; this.send(); }
  }
  send() {
    if (!this.ready || !this.sock || !this.want) return;
    this.sock.write(encodeFrame(OP.FRAME, { cmd: 'SET_ACTIVITY', args: { pid: this.pid, activity: activityOf(this.want) }, nonce: String(++this.nonce) }));
  }
}

module.exports = { Presence, encodeFrame, decodeFrames, activityOf, OP };
