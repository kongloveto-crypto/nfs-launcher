'use strict';
// Baixa um arquivo grande (instalador novo ou pacote de texturas) com segurança:
//   - grava em "<destino>.parte" e continua de onde parou (Range) se a conexão cair ou o jogo abrir no meio;
//   - confere o tamanho e o SHA-256 do arquivo inteiro antes de usar; se não bater, apaga a parte e falha;
//   - só então troca de nome para o destino e guarda o SHA-256 ao lado ("<destino>.sha256"), para saber depois qual
//     versão está no disco sem ler tudo de novo.
// `fetch` vem de fora (net.fetch do Electron no app, um falso nos testes).
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const path = require('path');

const partOf = (dest) => `${dest}.parte`;
const shaFileOf = (dest) => `${dest}.sha256`;

async function hashFile(file) {
  const h = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) h.update(chunk);
  return h.digest('hex');
}

// SHA-256 guardado do arquivo baixado (null: não há arquivo ou não foi baixado por aqui).
function savedSha(dest) {
  try {
    const st = fs.statSync(dest);
    const s = fs.readFileSync(shaFileOf(dest), 'utf8').trim().split(/\s+/);
    return s[0] && Number(s[1]) === st.size ? s[0].toLowerCase() : null;
  } catch { return null; }
}

// { url, dest, size, sha256, fetch, signal?, onProgress?(baixado, total) }. Devolve o destino; erro com .code.
async function download({ url, dest, size, sha256, fetch, signal, onProgress = () => {} }) {
  const part = partOf(dest);
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  let have = 0;
  try { have = fs.statSync(part).size; } catch { have = 0; }
  if (have > size) { await fsp.rm(part, { force: true }); have = 0; }
  if (have < size) {
    const headers = have > 0 ? { range: `bytes=${have}-` } : {};
    const res = await fetch(url, { headers, signal, credentials: 'omit', cache: 'no-store', redirect: 'follow' });
    if (res.status === 200) have = 0; // o servidor mandou tudo de novo
    else if (res.status !== 206) throw Object.assign(new Error(`HTTP ${res.status}`), { code: 'http' });
    const fd = fs.openSync(part, have ? 'a' : 'w');
    try {
      onProgress(have, size);
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (have + value.length > size) throw Object.assign(new Error('arquivo maior que o esperado'), { code: 'size' });
        fs.writeSync(fd, value);
        have += value.length;
        onProgress(have, size);
      }
    } finally { fs.closeSync(fd); }
  }
  if (have !== size) throw Object.assign(new Error('download incompleto'), { code: 'short' });
  const got = await hashFile(part);
  if (got !== String(sha256).toLowerCase()) {
    await fsp.rm(part, { force: true });
    throw Object.assign(new Error('arquivo diferente do publicado (SHA-256)'), { code: 'sha' });
  }
  await fsp.rename(part, dest);
  await fsp.writeFile(shaFileOf(dest), `${got} ${size}\n`);
  return dest;
}

module.exports = { download, hashFile, savedSha, partOf, shaFileOf };
