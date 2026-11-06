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
// Versões de instalador que aparecem na lista da pasta (outros arquivos, como o .apk, são ignorados).
function versionsIn(html) {
  return [...String(html).matchAll(/NFS-Launcher-Setup-(\d{1,4}\.\d{1,4}\.\d{1,4})\.exe/g)].map((m) => m[1]);
}
// A versão mais nova da pasta, se for maior que a instalada; senão null.
function newer(html, current) {
  const best = versionsIn(html).reduce((a, v) => (!a || compare(v, a) > 0 ? v : a), null);
  return best && compare(best, current) > 0 ? best : null;
}

module.exports = { FOLDER_URL, LIST_URL, compare, versionsIn, newer };
