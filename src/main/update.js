'use strict';
// Verificação de atualização (lógica pura). O Bruno publica o instalador numa pasta pública do Google Drive
// (sempre só a versão mais nova). O app lê a LISTA de arquivos dessa pasta (só os nomes, nada é baixado nem
// enviado), acha "NFS-Launcher-Setup-<versão>.exe" e compara com a versão instalada.
// O botão "Baixar" abre a pasta no navegador padrão: quem baixa e instala é o próprio jogador.
const FOLDER_ID = '1rVrBR33DFZT8ANuwn2IJtMsOhn-m7pk8';
const FOLDER_URL = `https://drive.google.com/drive/folders/${FOLDER_ID}`;
const LIST_URL = `https://drive.google.com/embeddedfolderview?id=${FOLDER_ID}`;

const parse = (v) => (/^\d+\.\d+\.\d+$/.test(String(v)) ? String(v).split('.').map(Number) : null);
function compare(a, b) {
  const x = parse(a); const y = parse(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return 0;
}
// Duas linhas de instalador (pedido do Bruno, 06/11): sem texturas (2.x, ~100 MB) e com texturas (3.x em diante).
// O nome pode trazer a linha ("-sem-texturas", "-com-texturas"); sem complemento, vale o número: 2.x = sem, o resto = com.
// Cada app só avisa da versão nova da própria linha, para quem escolheu o instalador leve não ser mandado ao pesado.
const FILE_RE = /NFS-Launcher-Setup-(\d{1,4}\.\d{1,4}\.\d{1,4})(-[A-Za-z]+(?:-[A-Za-z]+)*)?\.exe/g;
const lineOfVersion = (v) => (String(v).split('.')[0] === '2' ? 'sem' : 'com');
function lineOf(v, suffix) {
  const s = String(suffix || '').toLowerCase();
  if (s.includes('sem-textura')) return 'sem';
  if (s.includes('com-textura')) return 'com';
  return lineOfVersion(v);
}
// Instaladores da lista da pasta (outros arquivos, como o .apk, são ignorados): [{ v, line }].
function filesIn(html) {
  return [...String(html).matchAll(FILE_RE)].map((m) => ({ v: m[1], line: lineOf(m[1], m[2]) }));
}
const versionsIn = (html) => filesIn(html).map((f) => f.v);
// A versão mais nova da pasta na linha do app instalado, se for maior que a instalada; senão null.
function newer(html, current) {
  const mine = lineOfVersion(current);
  const best = filesIn(html).filter((f) => f.line === mine).reduce((a, f) => (!a || compare(f.v, a) > 0 ? f.v : a), null);
  return best && compare(best, current) > 0 ? best : null;
}

module.exports = { FOLDER_URL, LIST_URL, compare, versionsIn, filesIn, lineOfVersion, newer };
