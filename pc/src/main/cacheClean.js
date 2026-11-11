'use strict';
// Cópias velhas dos arquivos do jogo (pedido do Bruno, 11/11: 13 GB no PC dele). O nfsu2-web guarda o que baixa no
// armazenamento do site (OPFS, pasta "cache") com o nome caminho.tamanho.data (datacache.ts, cacheKey) e um
// ".have" ao lado, e nunca apaga a versão anterior: cada troca de texturas (ou arquivo novo no site) deixava ~450 MB
// para trás. Antes de abrir o jogo, o app abre a lista do site numa página invisível da mesma pasta de dados e apaga,
// só dentro de "cache", o que não está na lista que o jogo vai receber (a nossa, com as texturas, ou a do site).
// Saves e configurações ficam fora de "cache" e nunca são tocados.

const MIN_FILES = 20; // lista menor que isso = resposta estranha: não apaga nada

// Mesmo nome do jogo (datacache.ts, cacheKey).
const cacheKey = (f) => `${String(f.p).replace(/[^A-Za-z0-9._-]/g, '_')}.${f.s ?? 0}.${f.m ?? 0}`;

// Nomes da pasta "cache" que o jogo não usa mais. Só nomes no formato do jogo (x.tamanho.data e o ".have").
function staleNames(names, manifest) {
  const files = manifest && Array.isArray(manifest.files) ? manifest.files.filter((f) => f && !f.d && f.p) : [];
  if (files.length < MIN_FILES) return [];
  const keep = new Set(files.map(cacheKey));
  return names.filter((n) => {
    const base = n.endsWith('.have') ? n.slice(0, -5) : n;
    return /^.+\.\d+\.\d+$/.test(base) && !keep.has(base);
  });
}

// Roda na página invisível (aberta no endereço da lista do site). Devolve { apagados, bytes } ou { erro }.
const pageCode = `(async () => {
  const cacheKey = ${cacheKey.toString()};
  const MIN_FILES = ${MIN_FILES};
  const staleNames = ${staleNames.toString()};
  let dir;
  try { dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('cache'); } catch { return { apagados: 0, bytes: 0 }; }
  const manifest = await (await fetch('/data-manifest', { cache: 'no-store' })).json();
  const names = [];
  for await (const [n, h] of dir.entries()) if (h.kind === 'file') names.push(n);
  let apagados = 0, bytes = 0;
  for (const n of staleNames(names, manifest)) {
    try {
      const size = (await (await dir.getFileHandle(n)).getFile()).size;
      await dir.removeEntry(n);
      apagados++; bytes += size;
    } catch { /* em uso: fica para a próxima */ }
  }
  return { apagados, bytes };
})().catch((e) => ({ erro: String(e && e.message || e) }))`;

module.exports = { MIN_FILES, cacheKey, staleNames, pageCode };
