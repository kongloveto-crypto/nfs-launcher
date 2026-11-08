'use strict';
// Atualizações e texturas pelo GitHub (pedido do Bruno, 08/11). Lógica pura, sem rede.
// O app lê dois arquivos pequenos do repositório (pasta pc/, ramo main) e baixa só o que eles apontam, sempre de
// "releases" deste mesmo repositório:
//   pc/atualizacao.json  { "versao": "3.0.3", "arquivo": "<endereço do .exe>", "tamanho": 123, "sha256": "…",
//                          "novidades": { "pt": "…", "en": "…" } }
//   pc/texturas.json     { "arquivos": [ { "id": "site", "arquivo": "<endereço do .pak>", "tamanho": 123, "sha256": "…" }, … ] }
// Endereço fora do repositório, tamanho fora do limite ou SHA-256 mal escrito: o item é ignorado. Depois de baixar,
// o arquivo só vale se o SHA-256 bater (downloader.js).
const REPO = 'vtrspeedman-cell/nfs-launcher';
const RAW = `https://raw.githubusercontent.com/${REPO}/main/`;
const UPDATE_URL = `${RAW}pc/atualizacao.json`;
const TEXTURES_URL = `${RAW}pc/texturas.json`;
const RELEASES_URL = `https://github.com/${REPO}/releases`;
const MAX_APP = 600 * 1024 ** 2;   // instalador
const MAX_PAK = 1536 * 1024 ** 2;  // um pacote de texturas

const parse = (v) => (/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(String(v)) ? String(v).split('.').map(Number) : null);
function compare(a, b) {
  const x = parse(a); const y = parse(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return 0;
}

// Só arquivos publicados nas releases deste repositório (o GitHub manda depois para o servidor de arquivos dele).
function okAsset(url, ext) {
  let u;
  try { u = new URL(String(url)); } catch { return false; }
  const name = decodeURIComponent(u.pathname.split('/').pop() || '');
  return u.protocol === 'https:' && u.hostname === 'github.com' && !u.search && !u.hash && !u.username
    && u.pathname.startsWith(`/${REPO}/releases/download/`) && /^[A-Za-z0-9._-]{1,120}$/.test(name) && name.toLowerCase().endsWith(ext);
}
const okSha = (s) => /^[0-9a-f]{64}$/i.test(String(s || ''));
const okSize = (n, max) => Number.isSafeInteger(n) && n > 0 && n <= max;
const text = (v, max = 600) => (typeof v === 'string' ? v.slice(0, max) : '');

// Versão nova do instalador, se o arquivo estiver certo e for maior que a instalada; senão null.
function newerApp(json, current) {
  const j = json && typeof json === 'object' ? json : {};
  if (!parse(j.versao) || compare(j.versao, current) <= 0) return null;
  if (!okAsset(j.arquivo, '.exe') || !okSize(j.tamanho, MAX_APP) || !okSha(j.sha256)) return null;
  const n = j.novidades && typeof j.novidades === 'object' ? j.novidades : {};
  return { version: j.versao, url: j.arquivo, size: j.tamanho, sha256: j.sha256.toLowerCase(), notes: { pt: text(n.pt), en: text(n.en) } };
}

// Pacotes de texturas oferecidos, só dos ids conhecidos (o mapa do site e os mods de texPack.js), um de cada.
function texturesList(json, ids) {
  const list = json && Array.isArray(json.arquivos) ? json.arquivos : [];
  const out = {};
  for (const f of list) {
    if (!f || typeof f !== 'object' || !ids.includes(f.id) || out[f.id]) continue;
    if (!okAsset(f.arquivo, '.pak') || !okSize(f.tamanho, MAX_PAK) || !okSha(f.sha256)) continue;
    out[f.id] = { id: f.id, url: f.arquivo, size: f.tamanho, sha256: f.sha256.toLowerCase() };
  }
  return out;
}

module.exports = { REPO, UPDATE_URL, TEXTURES_URL, RELEASES_URL, compare, okAsset, newerApp, texturesList };
