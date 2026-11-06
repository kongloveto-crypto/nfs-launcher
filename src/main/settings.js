'use strict';
const fs = require('fs');
const path = require('path');
const combo = require('./combo');

const DEFAULTS = Object.freeze({
  version: 6,
  startFullscreen: false,   // iniciar direto em tela cheia
  showHome: true,           // mostrar tela inicial antes do jogo
  protectFullscreen: true,  // tela cheia = modo protegido
  blockAltSpace: true,      // engole Alt+Espaço durante o jogo (menu do Windows)
  highPriority: false,      // prioridade "acima do normal" para o jogo e a GPU (opcional)
  showCorner: true,         // botão discreto (semitransparente) sobre o jogo
  prepareGame: false,       // prepara todo o código do jogo ao carregar, em vez de aos poucos na corrida. Vale ao reabrir
  lighterGpu: false,        // tira as checagens de cada comando gráfico (teste; o Chrome não faz isso). Vale ao reabrir
  unblockGpu: false,        // modo DirectX 11, para placa sem DirectX 12. Só oferecido a quem tem erro de WebGPU. Vale ao reabrir
  unblockTried: false,      // o app já tentou o modo DirectX 11 sozinho (tenta uma vez só)
  newDrawing: true,         // Skia Graphite + Delegated Compositing, juntos e ligados por padrão (decisão do Bruno, depois dos logs jogando). Vale ao reabrir
  secureDns: 'off',         // DNS seguro que fez o jogo abrir: fica ligado nas próximas aberturas (fora das configurações)
  antiAlias: false,         // anti-serrilhado do nosso motor (teste). Vale ao reabrir
  imageFilter: false,       // filtro de cor e nitidez sobre a imagem do jogo. Vale na hora
  imageMode: 'vivido',      // modo do filtro (imageFilter.js)
  hdTextures: true,         // texturas melhores do NFSU2 (pacote do instalador e pasta de mods). Vale ao iniciar ou recarregar o jogo
  sounds: true,             // sons nas telas do app (nunca durante o jogo)
  discord: true,            // mostra "Jogando NFS Launcher" no Discord aberto neste PC
  toggleCombo: 'Ctrl+F',    // entra E sai da tela cheia (também sai do modo protegido)
  exitCombo: 'Ctrl+Alt+Shift+P',
  bounds: null,
  maximized: false,
  guideBounds: null,        // posição/tamanho da janela do guia do Dyno
  guideOpacity: 0.75,       // os guias começam com 75% de opacidade (pedido do usuário)
  tipsDiscovered: false,    // o botão de dicas fica fixo na tela até o jogador usar as dicas uma vez
  lang: 'pt',               // idioma do app e das dicas ('pt' ou 'en'), escolhido na tela inicial ou nas configurações
  game: 'nfsu2',            // último jogo iniciado (vem selecionado na tela inicial; 1ª vez: NFSU2)
});
const { GAME_IDS, SECURE_DNS } = require('./config');
const { MODE_IDS } = require('./imageFilter');
const LANGS = ['pt', 'en'];
const USER_BOOLS = ['startFullscreen', 'highPriority', 'prepareGame', 'lighterGpu', 'unblockGpu', 'newDrawing', 'antiAlias', 'imageFilter', 'hdTextures'];
// Sempre ligadas e fora das configurações (pedido do Bruno): vale também para quem tinha desligado antes.
const ALWAYS_ON = ['showHome', 'protectFullscreen', 'blockAltSpace', 'showCorner', 'sounds', 'discord'];
const BOOLS = [...USER_BOOLS, 'maximized', 'tipsDiscovered', 'unblockTried'];
const OPACITY = (v, d) => (Number.isFinite(v) && v >= 0.3 && v <= 1 ? Math.round(v * 100) / 100 : d);

function sanitizeBounds(b, minW = 640, minH = 360) {
  if (!b || typeof b !== 'object') return null;
  const n = (v) => (Number.isFinite(v) ? Math.round(v) : null);
  const out = { x: n(b.x), y: n(b.y), width: n(b.width), height: n(b.height) };
  if (Object.values(out).some((v) => v === null)) return null;
  if (out.width < minW || out.height < minH || out.width > 16000 || out.height > 16000) return null;
  return out;
}
function sanitize(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const out = { ...DEFAULTS };
  for (const k of BOOLS) if (typeof r[k] === 'boolean') out[k] = r[k];
  for (const k of ALWAYS_ON) out[k] = true;
  if (combo.validate(r.toggleCombo).ok) out.toggleCombo = r.toggleCombo;
  if (combo.validate(r.exitCombo).ok) out.exitCombo = r.exitCombo;
  if (out.toggleCombo === out.exitCombo) { out.toggleCombo = DEFAULTS.toggleCombo; out.exitCombo = DEFAULTS.exitCombo; }
  out.bounds = sanitizeBounds(r.bounds);
  out.guideBounds = sanitizeBounds(r.guideBounds, 200, 140);
  out.guideOpacity = OPACITY(r.guideOpacity, DEFAULTS.guideOpacity);
  if (LANGS.includes(r.lang)) out.lang = r.lang;
  if (MODE_IDS.includes(r.imageMode)) out.imageMode = r.imageMode;
  if (GAME_IDS.includes(r.game)) out.game = r.game;
  if (Object.hasOwn(SECURE_DNS, r.secureDns)) out.secureDns = r.secureDns;
  // Preferências de antes da versão 4 guardavam os padrões antigos: opacidade do guia 50% -> 75% e
  // tela cheia Ctrl+Alt+F -> Ctrl+F (só se a pessoa não tinha trocado o atalho).
  if (!(Number(r.version) >= 4)) {
    out.guideOpacity = DEFAULTS.guideOpacity;
    if (out.toggleCombo === 'Ctrl+Alt+F' && out.exitCombo !== DEFAULTS.toggleCombo) out.toggleCombo = DEFAULTS.toggleCombo;
  }
  // Antes da versão 6, o arquivo guardava Graphite e Delegated separados, ou desligados só por serem o padrão antigo:
  // a opção única passa a ligada uma vez. Depois disso, quem desmarcar continua desmarcado.
  if (!(Number(r.version) >= 6)) out.newDrawing = true;
  return out;
}
function load(file) {
  try { return sanitize(JSON.parse(fs.readFileSync(file, 'utf8'))); } catch { return { ...DEFAULTS }; }
}
function save(file, cfg) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));
    fs.renameSync(tmp, file);
    return true;
  } catch { return false; }
}
function applyChange(cfg, key, value) {
  if (USER_BOOLS.includes(key)) {
    if (typeof value !== 'boolean') return { ok: false, error: 'Valor inválido.' };
    return { ok: true, cfg: { ...cfg, [key]: value } };
  }
  if (key === 'toggleCombo' || key === 'exitCombo') {
    const v = combo.validate(value);
    if (!v.ok) return { ok: false, error: v.reason };
    const other = key === 'toggleCombo' ? cfg.exitCombo : cfg.toggleCombo;
    if (value === other) return { ok: false, error: 'Os dois atalhos não podem ser iguais.' };
    return { ok: true, cfg: { ...cfg, [key]: value } };
  }
  if (key === 'lang') {
    if (!LANGS.includes(value)) return { ok: false, error: 'Idioma inválido.' };
    return { ok: true, cfg: { ...cfg, lang: value } };
  }
  if (key === 'imageMode') {
    if (!MODE_IDS.includes(value)) return { ok: false, error: 'Modo inválido.' };
    return { ok: true, cfg: { ...cfg, imageMode: value } };
  }
  return { ok: false, error: 'Configuração desconhecida.' };
}
module.exports = { DEFAULTS, LANGS, sanitize, load, save, applyChange, OPACITY };
