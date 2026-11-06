'use strict';
// Mods de textura do NFSU2 (pedido do Bruno, 06/11): visuais e só no PC de quem instalou.
// O jogo lê os arquivos pela lista do site (/data-manifest) e os baixa em blocos de 1 MiB
// (/data-blocks/<v>/<caminho>?b=&n=&m=&s=, ou /data/<caminho> com Range). Ele aceita qualquer arquivo da lista.
// O app acrescenta à lista os arquivos da pasta de mods (ou troca o tamanho e a data de um que já existe)
// e entrega só esses. O resto vem do site como sempre: nada de script na página e nenhum arquivo do jogo alterado.
// O jogo guarda o que baixa numa cópia própria com nome caminho.tamanho.data: trocar o arquivo do mod gera outro nome,
// e nada da cópia antiga é apagado aqui.
const fs = require('fs');
const path = require('path');

const BLOCK = 1 << 20;
const SCHEME = 'nfsmod';
const MAX_FILES = 500;
// Só a raiz da árvore do jogo: um nome de pasta ou arquivo comum, sem "..", sem barra invertida, sem ":".
const SEGMENT = /^[A-Za-z0-9 _.()+-]{1,96}$/;
const okSegment = (s) => SEGMENT.test(s) && s !== '.' && s !== '..';

// Arquivos da pasta de mods, com o caminho como o jogo usa ("TEXPACKS/meu.pak").
function scan(root) {
  const out = [];
  const walk = (dir, rel) => {
    let list;
    try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const d of list) {
      if (out.length >= MAX_FILES || !okSegment(d.name)) continue;
      const full = path.join(dir, d.name);
      const p = rel ? `${rel}/${d.name}` : d.name;
      if (d.isDirectory()) { if (p.split('/').length < 8) walk(full, p); continue; }
      if (!d.isFile()) continue; // atalhos e ligações ficam de fora
      try {
        const st = fs.statSync(full);
        if (st.size > 0 && st.size < 0xFFFFFFFF) out.push({ p, file: full, s: st.size, m: Math.floor(st.mtimeMs / 1000) });
      } catch { /* sumiu no meio: ignora */ }
    }
  };
  walk(root, '');
  return out;
}

// Lista do site com os mods: arquivo que já existe (sem diferenciar maiúsculas) troca de tamanho e data e mantém o
// nome do site; arquivo novo entra com as pastas que faltarem. Devolve a lista e o caminho final de cada mod.
function patchManifest(manifest, mods) {
  if (!manifest || !Array.isArray(manifest.files)) throw new Error('lista de arquivos do jogo sem "files"');
  const files = manifest.files.map((f) => ({ ...f }));
  const byLower = new Map(files.map((f, i) => [String(f.p).toLowerCase(), i]));
  const served = new Map();
  for (const mod of mods) {
    const key = mod.p.toLowerCase();
    if (byLower.has(key)) {
      const f = files[byLower.get(key)];
      if (f.d) continue; // pasta do site com o mesmo nome de um arquivo do mod
      f.s = mod.s; f.m = mod.m;
      served.set(f.p, mod);
      continue;
    }
    const parts = mod.p.split('/');
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join('/');
      if (!byLower.has(dir.toLowerCase())) { byLower.set(dir.toLowerCase(), files.length); files.push({ p: dir, d: 1 }); }
      else if (!files[byLower.get(dir.toLowerCase())].d) { parts.length = 0; break; } // arquivo do site no lugar da pasta
    }
    if (!parts.length) continue;
    byLower.set(key, files.length);
    files.push({ p: mod.p, s: mod.s, m: mod.m });
    served.set(mod.p, mod);
  }
  return { manifest: { ...manifest, files }, served };
}

// Mesmo formato do jogo (datacache.ts): cada parte do caminho com encodeURIComponent.
const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');

// Endereços que o app precisa atender: a lista e os arquivos dos mods, nos dois formatos de pedido do jogo.
function urlFilters(hosts, servedPaths) {
  const urls = [];
  for (const h of hosts) {
    if (h.startsWith('.')) continue;
    urls.push(`https://${h}/data-manifest*`);
    for (const p of servedPaths) urls.push(`https://${h}/data-blocks/*/${encodePath(p)}*`, `https://${h}/data/${encodePath(p)}*`);
  }
  return urls;
}

// Pedido do jogo -> o que entregar. null = não é nosso (segue para o site).
function route(url, served) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (u.pathname === '/data-manifest') return { kind: 'manifest' };
  let rest = null, kind = null;
  const blocks = /^\/data-blocks\/[^/]+\/(.+)$/.exec(u.pathname);
  if (blocks) { rest = blocks[1]; kind = 'blocks'; } else if (u.pathname.startsWith('/data/')) { rest = u.pathname.slice(6); kind = 'file'; }
  if (!rest) return null;
  let p;
  try { p = rest.split('/').map(decodeURIComponent).join('/'); } catch { return null; }
  const mod = served.get(p);
  if (!mod) return null;
  if (kind === 'file') return { kind, p };
  const b = Number(u.searchParams.get('b')), n = Number(u.searchParams.get('n'));
  if (!Number.isInteger(b) || !Number.isInteger(n) || b < 0 || n < 1 || n > 64) return { kind: 'bad', p };
  return { kind, p, b, n, m: Number(u.searchParams.get('m')), s: Number(u.searchParams.get('s')) };
}

// Trecho [início, fim) do arquivo para um pedido de blocos; null se o pedido não bate com o arquivo de agora.
function blockSpan(r, mod) {
  if (r.m !== mod.m || r.s !== mod.s) return null; // lista antiga: o jogo pede de novo com a nova
  const start = r.b * BLOCK;
  if (start >= mod.s) return null;
  return { start, end: Math.min(mod.s, (r.b + r.n) * BLOCK) };
}

// Cabeçalho Range "bytes=a-b" (ou "bytes=a-"). null = sem Range (arquivo inteiro); false = inválido.
function rangeSpan(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d+)-(\d*)$/.exec(String(header).trim());
  if (!m) return false;
  const start = Number(m[1]);
  const end = m[2] === '' ? size : Math.min(size, Number(m[2]) + 1);
  if (start >= size || end <= start) return false;
  return { start, end };
}

function readSpan(file, start, end) {
  const fd = fs.openSync(file, 'r');
  try {
    const b = Buffer.alloc(end - start);
    let got = 0;
    while (got < b.length) {
      const n = fs.readSync(fd, b, got, b.length - got, start + got);
      if (n <= 0) break;
      got += n;
    }
    return got === b.length ? b : null;
  } finally { fs.closeSync(fd); }
}

// Liga os mods na sessão do jogo. Só os endereços da lista e dos arquivos dos mods passam pelo app (filtro do
// webRequest); eles vão para o esquema próprio, que lê a lista do site e entrega os arquivos daqui.
// `fetchManifest(url)`: busca a lista por uma sessão que não seja a do jogo (senão o pedido volta para cá).
// `allowed(url)`: o endereço é do site do NFSU2. Precisa de protocol.registerSchemesAsPrivileged antes do `ready`.
function install(ses, { mods, hosts, allowed, fetchManifest }) {
  if (!mods.length) return null;
  const HEAD = { 'cache-control': 'no-store', 'cross-origin-resource-policy': 'cross-origin', 'access-control-allow-origin': '*' };
  const fail = (status) => new Response(null, { status, headers: HEAD });
  let served = new Map(mods.map((m) => [m.p, m]));
  let manifestUrl = null;
  const listen = (paths) => {
    ses.webRequest.onBeforeRequest({ urls: urlFilters(hosts, paths) }, (d, cb) => {
      const r = route(d.url, served);
      if (!r) return cb({});
      if (r.kind === 'manifest') manifestUrl = d.url;
      cb({ redirectURL: `${SCHEME}://mod/${r.kind}?u=${encodeURIComponent(d.url)}` });
    });
  };
  ses.protocol.handle(SCHEME, async (req) => {
    try {
      const u = new URL(req.url).searchParams.get('u');
      const r = u && route(u, served);
      if (!r) return fail(404);
      if (r.kind === 'manifest') {
        if (!allowed(u) || u !== manifestUrl) return fail(404);
        const res = await fetchManifest(manifestUrl);
        if (!res.ok) return fail(res.status);
        const out = patchManifest(await res.json(), mods);
        served = out.served;
        // Arquivo que troca um do site com outra caixa de letra: o filtro passa a usar o nome do site.
        if ([...served.keys()].some((p) => !mods.some((m) => m.p === p))) listen([...served.keys()]);
        return new Response(JSON.stringify(out.manifest), { headers: { ...HEAD, 'content-type': 'application/json' } });
      }
      const mod = served.get(r.p);
      if (!mod || r.kind === 'bad') return fail(400);
      // O arquivo mudou com o app aberto: não entrega pedaço misturado (vale ao reabrir).
      const st = fs.statSync(mod.file);
      if (st.size !== mod.s || Math.floor(st.mtimeMs / 1000) !== mod.m) return fail(409);
      let span, status = 200;
      const headers = { ...HEAD, 'content-type': 'application/octet-stream' };
      if (r.kind === 'blocks') {
        span = blockSpan(r, mod);
        if (!span) return fail(409);
      } else {
        span = rangeSpan(req.headers.get('range'), mod.s);
        if (span === false) return fail(416);
        if (span) { status = 206; headers['content-range'] = `bytes ${span.start}-${span.end - 1}/${mod.s}`; } else span = { start: 0, end: mod.s };
      }
      const body = readSpan(mod.file, span.start, span.end);
      return body ? new Response(body, { status, headers }) : fail(409);
    } catch { return fail(500); }
  });
  listen(mods.map((m) => m.p));
  return { served: () => served };
}

module.exports = { BLOCK, SCHEME, scan, patchManifest, urlFilters, route, blockSpan, rangeSpan, readSpan, encodePath, install };
