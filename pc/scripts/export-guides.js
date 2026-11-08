'use strict';
// Exporta os guias passo a passo (src/renderer/tips.js) para JSON, nos dois idiomas, para o app Android
// montar o guia com componentes nativos (mais leve que uma página). Uso: node scripts/export-guides.js <saida.json>
const fs = require('fs');
const path = require('path');
const T = require('../src/renderer/tips');

const out = {};
for (const lang of T.LANGS) {
  const C = T.build(lang);
  out[lang] = {
    ui: C.UI,
    groups: C.GROUP_TITLES,
    guides: C.GUIDES.map((g) => ({
      id: g.id, group: g.group, short: g.short, title: g.title,
      end: g.end || (g.group === 'glitch' ? C.UI.endGlitch : C.UI.endTune),
      next: g.next || null, nextLabel: g.nextLabel || null,
      steps: T.guideSteps(g),
    })),
  };
}
const file = process.argv[2];
if (!file) { console.error('uso: node scripts/export-guides.js <guias.json> [catalogo.json]'); process.exit(1); }
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(out));
console.log(`guias exportados: ${out.pt.guides.length} (pt/en) -> ${file}`);

// Catálogo de jogos: o mesmo do app de PC (src/main/config.js). Jogo novo = só mexer lá.
const catalogFile = process.argv[3];
if (catalogFile) {
  const { GAMES, GAME_IDS, DEFAULT_GAME } = require('../src/main/config');
  const games = GAME_IDS.map((id) => {
    const g = GAMES[id];
    return { id, short: g.short, name: g.name, url: g.url, startUrl: g.startUrl || g.url, hosts: g.hosts, disc: g.disc, tips: g.tips, host: new URL(g.url).host };
  });
  fs.writeFileSync(catalogFile, JSON.stringify({ defaultGame: DEFAULT_GAME, games }));
  console.log(`catálogo exportado: ${games.map((g) => g.short).join(', ')} -> ${catalogFile}`);
}
