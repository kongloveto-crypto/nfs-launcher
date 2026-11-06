'use strict';
// Texturas HD do NFSU2 (pedido do Bruno, 06/11): o jogo só carrega o pacote de mapa (TEXPACKS/detailed.pak, onde estão
// as texturas HD) com "ui_textures" em map ou uhud no settings.ini dele. Muita gente não sabe ligar, então, com a opção
// "Texturas HD" ligada, o app troca SÓ essa linha para "ui_textures = map" (mapa detalhado; menus e HUD continuam os do
// jogo). Única escrita do app nos dados do jogo, e só nesta linha:
//   - ao abrir o app, antes de o navegador abrir os dados (com o jogo aberto, o arquivo podia se estragar);
//   - só se a linha estiver em "original" ou ausente: "map" e "uhud" (HUD HD) ficam como o jogador deixou;
//   - nunca com "NFSU2_MAP_TEXTURES" escrito pelo jogador (ele escolheu o mapa à mão);
//   - cópia do arquivo antes, fora da pasta do jogo;
//   - com a opção desligada, volta a linha ao que era, só se foi o app que trocou e ela continua "map".
const fsp = require('fs').promises;
const path = require('path');
const saveCopy = require('./saveCopy');

const UI_LINE = 'ui_textures = map';
const KEY = /^\s*ui_textures\s*=\s*([^\s#;]*)/i;
const MAP_KEY = /^\s*NFSU2_MAP_TEXTURES\s*=/i;
const active = (l) => !/^\s*[#;]/.test(l);
const BACKUP = 'settings.ini-antes-das-texturas-HD.txt';

// Só o texto: o que muda no settings.ini. prev = linha que o app trocou (null: o app não trocou nada; '': não havia linha).
// Devolve { text, prev, changed, uiOn } — uiOn: o jogo vai carregar o pacote de mapa com este texto.
function plan(text, { on, prev = null }) {
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const i = lines.findIndex((l) => active(l) && KEY.test(l)); // a primeira linha de cada opção é a que vale
  const val = i >= 0 ? KEY.exec(lines[i])[1].toLowerCase() : '';
  const uiOn = val === 'map' || val === 'uhud';
  if (lines.some((l) => active(l) && MAP_KEY.test(l))) return { text, prev: null, changed: false, uiOn: false, why: 'mapa escolhido pelo jogador' };
  if (on) {
    if (uiOn) return { text, prev, changed: false, uiOn: true };
    const before = i >= 0 ? lines[i] : '';
    if (i >= 0) lines[i] = UI_LINE;
    else {
      while (lines.length && lines[lines.length - 1] === '') lines.pop();
      lines.push(UI_LINE, '');
    }
    return { text: lines.join(nl), prev: before, changed: true, uiOn: true };
  }
  if (prev === null || prev === undefined) return { text, prev: null, changed: false, uiOn };
  if (val !== 'map') return { text, prev: null, changed: false, uiOn }; // o jogador mudou depois: fica o dele
  if (prev) lines[i] = prev; else lines.splice(i, 1);
  return { text: lines.join(nl), prev: null, changed: true, uiOn: false }; // o app só troca o que estava em original
}

// Acha o settings.ini do NFSU2 (pelo começo do arquivo, como a cópia do save) e aplica o plano.
// Desiste sem escrever se achar mais de um, se não achar, ou se a procura passar de budgetMs.
async function run({ root, backupDir, on, prev = null, budgetMs = 3000 }) {
  const t0 = Date.now();
  const late = () => Date.now() - t0 > budgetMs;
  const found = [];
  for (const f of await saveCopy.listFiles(root)) {
    if (f.size < 20 || f.size > 200000) continue;
    if (late()) return { prev, uiOn: false, why: 'demorou' };
    let head;
    try { head = await saveCopy.readHead(f.path, 32); } catch { continue; }
    if (saveCopy.kindOf(head) === 'settings.ini') found.push(f.path);
  }
  if (found.length !== 1) return { prev, uiOn: false, why: found.length ? 'mais de um settings.ini' : 'sem settings.ini' };
  const file = found[0];
  const text = await fsp.readFile(file, 'latin1'); // byte a byte: o resto do arquivo volta igual
  const p = plan(text, { on, prev });
  if (!p.changed) return { ...p, text: undefined };
  if (late()) return { prev, uiOn: false, why: 'demorou' };
  await fsp.mkdir(backupDir, { recursive: true });
  await fsp.writeFile(path.join(backupDir, BACKUP), text, 'latin1');
  // Grava ao lado da cópia e troca de uma vez: um arquivo pela metade nunca fica no lugar do settings.ini.
  const tmp = path.join(backupDir, `${BACKUP}.novo`);
  await fsp.writeFile(tmp, p.text, 'latin1');
  await fsp.rename(tmp, file);
  return { ...p, text: undefined, file };
}

module.exports = { plan, run, UI_LINE, BACKUP };
