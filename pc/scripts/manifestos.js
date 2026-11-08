'use strict';
// Monta as 4 listas que os apps leem no GitHub (pc/ e mobile/: atualizacao.json e texturas.json), com o tamanho e o
// SHA-256 dos arquivos que vão para as releases. Rodar depois de montar o instalador, o APK ou os pacotes, antes de
// publicar a release. Só lê os arquivos; as "novidades" de cada lista ficam como estão (editar à mão).
//
// Uso (na pasta pc):  node scripts/manifestos.js
//   TEX_TAG=texturas-1   release das texturas (PC e celular juntos: o mapa do site é o mesmo arquivo)
// Pacotes: os do PC em C:\e\texturas\fontes; os do celular (1x e 2x) em C:\e\texturas\celular-github; o mapa do
// site é o mesmo arquivo nos dois (fontes\site.pak), publicado uma vez só.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { REPO } = require('../src/main/github');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const REL = `https://github.com/${REPO}/releases/download`;
const TEX_TAG = process.env.TEX_TAG || 'texturas-1';
const FONTES = 'C:\\e\\texturas\\fontes';
const CELULAR = 'C:\\e\\texturas\\celular-github';
const srcOf = (id) => path.join(/-\dx$/.test(id) ? CELULAR : FONTES, `${id}.pak`);
const PC_TEX = ['site', 'texwizard', 'redux', 'definitive', 'nextgen'];
const MOBILE_TEX = ['site', 'texwizard-1x', 'texwizard-2x', 'nextgen-1x', 'nextgen-2x'];

const sha = (f) => new Promise((ok, bad) => {
  const h = crypto.createHash('sha256');
  fs.createReadStream(f).on('data', (d) => h.update(d)).on('end', () => ok(h.digest('hex'))).on('error', bad);
});
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } };
const write = (f, o) => { fs.writeFileSync(f, `${JSON.stringify(o, null, 2)}\n`); console.log(`gravado ${path.relative(ROOT, f)}`); };

async function app(file, version, tag, out) {
  const old = readJson(out);
  const j = { versao: version, arquivo: `${REL}/${tag}/${path.basename(file)}`, tamanho: 0, sha256: '', novidades: old.novidades || { pt: '', en: '' } };
  if (fs.existsSync(file)) { j.tamanho = fs.statSync(file).size; j.sha256 = await sha(file); } else console.log(`(sem ${path.basename(file)}: tamanho e SHA-256 vazios, o app ignora)`);
  write(out, j);
}

async function textures(ids, out) {
  const arquivos = [];
  for (const id of ids) {
    const f = srcOf(id);
    if (!fs.existsSync(f)) { console.log(`(sem ${f})`); continue; }
    arquivos.push({ id, arquivo: `${REL}/${TEX_TAG}/${id}.pak`, tamanho: fs.statSync(f).size, sha256: await sha(f) });
  }
  write(out, { arquivos });
}

(async () => {
  const pcVer = require('../package.json').version;
  const apkVer = fs.readFileSync(path.join(ROOT, 'mobile/app/java/xyz/nfs/launcher/MainActivity.java'), 'utf8').match(/VERSION = "([\d.]+)"/)[1];
  await app(path.join(DIST, `NFS-Launcher-Setup-${pcVer}.exe`), pcVer, `pc-${pcVer}`, path.join(ROOT, 'pc/atualizacao.json'));
  await app(path.join(DIST, `NFS-Launcher-Android-${apkVer}.apk`), apkVer, `android-${apkVer}`, path.join(ROOT, 'mobile/atualizacao.json'));
  await textures(PC_TEX, path.join(ROOT, 'pc/texturas.json'));
  await textures(MOBILE_TEX, path.join(ROOT, 'mobile/texturas.json'));
})().catch((e) => { console.error(e); process.exit(1); });
