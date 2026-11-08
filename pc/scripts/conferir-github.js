// Lê as listas no main do GitHub e confere cada arquivo publicado (tamanho; SHA-256 nos menores de 40 MB). Uso, em pc/: node scripts/conferir-github.js
const crypto = require('crypto');
const RAW = 'https://raw.githubusercontent.com/vtrspeedman-cell/nfs-launcher/main/';
const UA = { 'User-Agent': 'nfs-launcher-check' };
const items = [];
const walk = (o) => { if (o && typeof o === 'object') { if (o.arquivo && o.sha256) items.push(o); for (const v of Object.values(o)) walk(v); } };
(async () => {
  for (const f of ['pc/atualizacao.json', 'mobile/atualizacao.json', 'pc/texturas.json', 'mobile/texturas.json']) {
    const r = await fetch(RAW + f, { headers: UA });
    const j = await r.json();
    console.log(f, r.status, j.versao || '');
    walk(j);
  }
  const seen = new Set();
  for (const it of items) {
    if (seen.has(it.arquivo)) continue; seen.add(it.arquivo);
    const name = it.arquivo.split('/').pop();
    if (it.tamanho < 40e6) {
      const b = Buffer.from(await (await fetch(it.arquivo, { headers: UA })).arrayBuffer());
      const sha = crypto.createHash('sha256').update(b).digest('hex');
      console.log(name, b.length === it.tamanho && sha === it.sha256.toLowerCase() ? 'ok (tamanho e SHA-256)' : `DIFERENTE ${b.length} ${sha}`);
    } else {
      const r = await fetch(it.arquivo, { method: 'HEAD', headers: UA });
      const len = +r.headers.get('content-length');
      console.log(name, r.status, len === it.tamanho ? 'ok (tamanho)' : `DIFERENTE ${len} != ${it.tamanho}`);
    }
  }
})();
