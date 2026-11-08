'use strict';
// Instalador leve, sem texturas (pedido do Bruno, 06/11): o mesmo app, sem os pacotes de textura e com o número da
// linha 2.x ("versaoLeve" no package.json). O número 2.x faz o instalador pular a página das texturas (installer.nsh)
// e o app avisar só das versões novas sem texturas (update.js). Montar: npm run dist:leve.
const pkg = require('../package.json');
module.exports = {
  ...pkg.build,
  extraResources: [],
  nsis: { ...pkg.build.nsis, artifactName: 'NFS-Launcher-Setup-${version}-sem-texturas.exe' },
  extraMetadata: { version: pkg.versaoLeve },
};
