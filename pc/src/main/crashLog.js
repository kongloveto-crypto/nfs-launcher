'use strict';
// Registro de quedas (pedido do Bruno, 08/11): quando o jogo, a placa de vídeo ou outro processo do motor cai, o app guarda
// só o tipo, o motivo, o código de saída, o jogo, o modo de vídeo e quanto tempo de jogo havia. Fica num arquivo no PC
// (quedas.json, nos dados do app), sai no relatório de diagnóstico e nunca é enviado a lugar nenhum. Sem dados pessoais.
const fs = require('fs');

const MAX = 30;                 // só as últimas
const WEEK = 7 * 24 * 3600e3;

// Motivos do Electron (render-process-gone / child-process-gone) em português.
const REASONS = {
  crashed: 'falha do motor',
  oom: 'faltou memória',
  'memory-eviction': 'liberado por falta de memória',
  killed: 'fechado pelo Windows ou por outro programa',
  'abnormal-exit': 'saiu com erro',
  'launch-failed': 'não abriu',
  'integrity-failure': 'arquivo do app alterado (antivírus?)',
  unresponsive: 'parou de responder',
};
const reasonText = (r) => REASONS[r] || String(r || 'desconhecido');

// Tipos: 'jogo' (página do jogo), 'GPU' (placa de vídeo), 'rede' (serviço de rede) ou o nome que o Electron der.
function entry({ kind, reason, exitCode, game, dx11, playedMs, when = Date.now() }) {
  return {
    when: new Date(when).toISOString(),
    kind: String(kind || 'outro').slice(0, 40),
    reason: String(reason || '').slice(0, 40),
    exitCode: Number.isFinite(exitCode) ? exitCode : null,
    game: game || null,
    dx11: !!dx11,
    playedMin: Number.isFinite(playedMs) && playedMs > 0 ? Math.round(playedMs / 60000) : null,
  };
}
const valid = (e) => e && typeof e.when === 'string' && typeof e.kind === 'string';
function add(list, e) { return [...(Array.isArray(list) ? list.filter(valid) : []), e].slice(-MAX); }

function load(file) {
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(j) ? j.filter(valid).slice(-MAX) : [];
  } catch { return []; }
}
// Grava por cima com arquivo temporário: queda no meio da gravação não estraga o registro.
function save(file, list) {
  try {
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(list, null, 1), 'utf8');
    fs.renameSync(`${file}.tmp`, file);
    return true;
  } catch { return false; }
}

// Pontos de atenção do relatório (últimos 7 dias). driver = onde baixar o driver da placa ativa.
function issues(list, { now = Date.now(), driver = 'o site do fabricante da placa de vídeo' } = {}) {
  const recent = (list || []).filter((e) => valid(e) && now - Date.parse(e.when) < WEEK);
  const count = (f) => recent.filter(f).length;
  const out = [];
  const gpu = count((e) => e.kind === 'GPU' && e.reason !== 'oom' && e.reason !== 'memory-eviction');
  const mem = count((e) => e.reason === 'oom' || e.reason === 'memory-eviction');
  const game = count((e) => e.kind === 'jogo' && e.reason === 'crashed');
  const net = count((e) => e.kind === 'rede');
  if (gpu >= 2) out.push(`O processo da placa de vídeo caiu ${gpu} vezes nos últimos 7 dias. Atualize o driver pelo ${driver}.`);
  if (mem) out.push(`Faltou memória ${mem} ${mem === 1 ? 'vez' : 'vezes'} nos últimos 7 dias. Feche outros programas (principalmente navegadores) antes de jogar.`);
  if (game >= 2) out.push(`O jogo caiu ${game} vezes nos últimos 7 dias. Os horários estão em "Quedas recentes"; envie este relatório a quem for ajudar.`);
  if (net) out.push(`O serviço de rede do app caiu ${net} ${net === 1 ? 'vez' : 'vezes'} nos últimos 7 dias (a conexão do jogo cai junto). Antivírus ou VPN podem causar isso.`);
  if (count((e) => e.reason === 'integrity-failure')) out.push('O Windows achou arquivos do app alterados: o antivírus pode estar mexendo neles. Reinstale o app e coloque a pasta dele nas exceções do antivírus.');
  return out;
}

// Linhas da seção "Quedas recentes" (mais nova primeiro).
function lines(list) {
  const l = (list || []).filter(valid).slice().reverse().slice(0, 15);
  if (!l.length) return ['Nenhuma queda registrada.'];
  return l.map((e) => [
    e.when.replace('T', ' ').slice(0, 19),
    e.kind,
    reasonText(e.reason),
    e.exitCode === null ? null : `código ${e.exitCode}`,
    e.game ? `jogo ${e.game}` : null,
    e.dx11 ? 'DirectX 11' : null,
    e.playedMin === null ? null : `${e.playedMin} min de jogo`,
  ].filter(Boolean).join(' · '));
}

module.exports = { entry, add, load, save, issues, lines, reasonText, MAX };
