'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { TABS } = require('../src/renderer/tips');
const { decideKey } = require('../src/main/lockPolicy');
const combo = require('../src/main/combo');
const settings = require('../src/main/settings');

test('dicas: abas com id único e só blocos conhecidos (texto puro)', () => {
  const ids = TABS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of TABS) {
    assert.ok(t.title && t.blocks.length, t.id);
    for (const b of t.blocks) {
      const keys = Object.keys(b);
      assert.equal(keys.length, 1, `${t.id}: ${JSON.stringify(b)}`);
      assert.ok(['h', 'p', 'note', 'ul', 'ol', 'kv', 'guide'].includes(keys[0]), keys[0]);
      const texts = b.kv ? b.kv.flat() : [].concat(b[keys[0]]);
      for (const s of texts) assert.equal(typeof s, 'string');
    }
  }
});
test('dicas: tuning do AE86 e glitches presentes, sem mapa', () => {
  assert.deepEqual(TABS.map((t) => t.id), ['ae86', 'glitches', 'carros']);
  const ae86 = TABS.find((t) => t.id === 'ae86');
  assert.deepEqual(ae86.blocks.filter((b) => b.guide).map((b) => b.guide), ['t1', 't2', 't3'], 'tuning do AE86 abre como guia');
});
test('guias passo a passo: ids válidos, cada um com botão na aba e passos na ordem', () => {
  const { GUIDES, guideSteps } = require('../src/renderer/tips');
  const { GROUP_TITLES } = require('../src/renderer/tips');
  const buttons = TABS.flatMap((t) => t.blocks.filter((b) => b.guide).map((b) => b.guide));
  for (const g of GUIDES) {
    assert.match(g.id, /^[gt]\d{1,2}$/, 'o main só aceita ids gN/tN');
    assert.ok(buttons.includes(g.id), `sem botão nas dicas: ${g.id}`);
    assert.ok(GROUP_TITLES[g.group] && g.short, `${g.id} sem grupo/nome curto`);
    const s = guideSteps(g);
    assert.equal(s.length, g.parts.reduce((n, p) => n + (p.steps || p.rows).length + (p.note ? 1 : 0) + (p.noteFirst ? 1 : 0), 0));
    assert.equal(s.find((x) => !x.note).n, 1);
    assert.ok(s.every((x) => typeof x.text === 'string' && x.text.length > 3));
  }
  assert.equal(guideSteps(GUIDES.find((g) => g.id === 't1'))[0].text, 'Motor: Instale tudo.');
  // Corolla pula direto para 3 barras: aviso no começo do guia e da aba.
  const g1First = guideSteps(GUIDES.find((g) => g.id === 'g1'))[0];
  assert.ok(g1First.note && /Corolla/.test(g1First.text) && /3 barras/.test(g1First.text));
  assert.equal(TABS.find((t) => t.id === 'glitches').blocks[0].note, g1First.text);
  const g2 = guideSteps(GUIDES.find((g) => g.id === 'g2'));
  assert.equal(g2.filter((x) => x.note).length, 2, 'avisos das partes A e B viram passos "Atenção"');
  assert.equal(g2[14].note, true);
  assert.equal(g2[15].part, 'Parte B — glitch da ECU');
  // Fim da parte B (2 e 3 barras): aviso claro para não mexer mais nas barras douradas / na ECU.
  const endB = g2.filter((x) => x.part === 'Parte B — glitch da ECU').pop();
  assert.ok(endB.note && /NÃO TOQUE NAS BARRAS DOURADAS/.test(endB.text) && /não ajuste mais a ECU/.test(endB.text));
  assert.ok(!g2.some((x) => /Parte C/.test(x.part)), 'a parte C é só do glitch de 3 barras');
  // Parte C fica no glitch de 3 barras: começa restaurando o padrão do Turbo e termina com o resultado esperado.
  const g3 = guideSteps(GUIDES.find((g) => g.id === 'g3'));
  const endB3 = g3.filter((x) => x.part === 'Parte B — preparação da ECU').pop();
  assert.ok(endB3.note && /NÃO TOQUE NAS BARRAS DOURADAS/.test(endB3.text) && /parte C/.test(endB3.text));
  const partC = g3.filter((x) => x.part === 'Parte C — ajuste final do Turbo');
  assert.equal(partC.length, 10);
  assert.match(partC[0].text, /Restaurar padrão/);
  assert.match(partC[0].text, /NÃO mexa na ECU nem nas barras douradas/, 'parte C lembra de não mexer nas barras douradas');
  assert.match(partC[9].text, /Não mexa nas barras douradas da ECU/);
  assert.match(partC[7].text, /passos 6 e 7/);
  assert.ok(partC[9].note && /8\.000 RPM/.test(partC[9].text) && /9\.000 RPM/.test(partC[9].text));
});
test('guias de outros carros: todos avisam que não são oficiais nem testados e dizem a fonte', () => {
  const T = require('../src/renderer/tips');
  for (const [lang, re, source] of [['pt', /NÃO oficial e NÃO testado/, 'Fonte:'], ['en', /UNOFFICIAL and UNTESTED/, 'Source:']]) {
    const C = T.build(lang);
    const cars = C.GUIDES.filter((g) => g.group === 'cars');
    assert.ok(cars.length >= 6);
    for (const g of cars) {
      const s = T.guideSteps(g);
      assert.match(s[0].text, re, `${g.id} sem aviso`);
      assert.ok(s[1].text.startsWith(source), `${g.id} sem fonte`);
      assert.match(g.title, lang === 'pt' ? /não oficial/ : /unofficial/);
    }
    assert.match(C.TABS.find((t) => t.id === 'carros').blocks[0].note, re);
  }
  // Decimais: vírgula em português, ponto em inglês.
  const row = (lang) => T.guideSteps(T.build(lang).GUIDES.find((g) => g.id === 't11')).find((x) => /-3[,.]30/.test(x.text)).text;
  assert.match(row('pt'), /-3,30 \/ -3,30/);
  assert.match(row('en'), /-3\.30 \/ -3\.30/);
});
test('fim dos guias do AE86: Peças -> Circuito -> Arrancada -> glitch da ECU', () => {
  const { GUIDES } = require('../src/renderer/tips');
  const by = (id) => GUIDES.find((g) => g.id === id);
  assert.deepEqual(['t1', 't2', 't3'].map((id) => by(id).next), ['t2', 't3', 'g1']);
  assert.match(by('t1').end, /dinamômetro/, 'Peças: avisa que agora é no Dyno');
  assert.match(by('t3').end, /glitch da ECU/);
  for (const g of GUIDES.filter((x) => x.next)) assert.ok(by(g.next) && g.nextLabel && g.end, g.id);
  // Glitches em sequência; o de 3 barras é o último, sem doação no app.
  assert.deepEqual(['g1', 'g2', 'g3'].map((id) => by(id).next), ['g2', 'g3', undefined]);
  assert.equal(require('../src/renderer/tips').DONATE, undefined, 'doação só na página do app');
  const tr = by('t1').parts[0].rows.find(([k]) => k === 'Transmissão')[1];
  for (const n of ['Differential', 'Limited Slip Differential', '6 Speed Transmission']) assert.ok(tr.includes(n), n);
});
test('inglês: mesma estrutura do português, todos os textos traduzidos', () => {
  const T = require('../src/renderer/tips');
  const pt = T.build('pt');
  const en = T.build('en');
  assert.deepEqual(en.TABS.map((t) => t.id), pt.TABS.map((t) => t.id));
  assert.deepEqual(en.GUIDES.map((g) => g.id), pt.GUIDES.map((g) => g.id));
  for (const g of pt.GUIDES) {
    const e = en.GUIDES.find((x) => x.id === g.id);
    assert.equal(T.guideSteps(e).length, T.guideSteps(g).length, `${g.id}: mesmo número de passos (progresso vale nos dois)`);
  }
  assert.deepEqual(Object.keys(en.UI).sort(), Object.keys(pt.UI).sort());
  // Texto em inglês não pode ter sobrado em português.
  const all = JSON.stringify(en);
  for (const w of ['Instale', 'Entre no', 'dinamômetro', 'Mínimo', 'Peças', 'barra dourada', 'Recolher', 'Voltar']) {
    assert.ok(!all.includes(w), `sobrou em português: ${w}`);
  }
  assert.equal(T.guideSteps(en.GUIDES.find((g) => g.id === 't1'))[0].text, 'Engine: Install everything.');
});
test('letra das dicas: padrão 20% maior, passos de 10%, entre 80% e 200%', () => {
  const T = require('../src/renderer/tips');
  assert.equal(T.FONT.def, 1.2);
  assert.equal(T.fontClamp(1.2 + T.FONT.step), 1.3);
  assert.equal(T.fontClamp(0.5), 0.8);
  assert.equal(T.fontClamp(9), 2);
  assert.equal(T.getFont(), 1.2, 'sem armazenamento (testes): usa o padrão');
});
test('recolher: ponto na borda mais próxima, dentro do monitor', () => {
  const dock = require('../src/main/dock');
  const area = { x: 0, y: 0, width: 2560, height: 1440 };
  const left = dock.dockSpot({ x: 30, y: 600, width: 400, height: 300 }, area);
  assert.equal(left.edge, 'left');
  assert.deepEqual(left.rect, { x: 0, y: 680, width: dock.THICK, height: dock.LENGTH });
  assert.equal(dock.dockSpot({ x: 2100, y: 500, width: 400, height: 300 }, area).edge, 'right');
  assert.equal(dock.dockSpot({ x: 1000, y: 1100, width: 400, height: 300 }, area).edge, 'bottom');
  const top = dock.dockSpot({ x: 40, y: 5, width: 400, height: 300 }, { x: 0, y: 0, width: 2560, height: 1440 });
  assert.equal(top.edge, 'top');
  assert.ok(top.rect.x >= dock.CORNER_GAP, 'longe do canto (o jogo não deixa o mouse ir aos cantos)');
  const second = dock.dockSpot({ x: 2600, y: 10, width: 300, height: 200 }, { x: 2560, y: 0, width: 1920, height: 1080 });
  assert.ok(second.rect.x >= 2560 + dock.CORNER_GAP, 'segundo monitor, longe do canto');
  const corner = dock.dockSpot({ x: 0, y: 1200, width: 300, height: 240 }, area);
  assert.ok(corner.rect.y + corner.rect.height <= area.height - dock.CORNER_GAP, 'janela no canto: o ponto sobe para longe dele');
  // Área de passar o mouse: a faixa + REACH px para dentro da tela.
  assert.ok(dock.inRect({ x: 5, y: 700 }, left.hover));
  assert.ok(dock.inRect({ x: 50, y: 700 }, left.hover), 'mouse que não chega até a borda ainda reabre');
  assert.ok(!dock.inRect({ x: 120, y: 700 }, left.hover));
  assert.ok(dock.inRect({ x: 2500, y: 600 }, dock.dockSpot({ x: 2100, y: 500, width: 400, height: 300 }, area).hover));
});
test('janelas flutuantes ficam dentro da área do jogo', () => {
  const dock = require('../src/main/dock');
  const area = { x: 100, y: 50, width: 1280, height: 720 };
  assert.deepEqual(dock.fitInside({ x: 300, y: 200, width: 360, height: 210 }, area), { x: 300, y: 200, width: 360, height: 210 }, 'já dentro: não mexe');
  assert.deepEqual(dock.fitInside({ x: 3000, y: 2000, width: 360, height: 210 }, area), { x: 1020, y: 560, width: 360, height: 210 }, 'fora, à direita e embaixo: encosta na borda');
  assert.deepEqual(dock.fitInside({ x: -500, y: -500, width: 360, height: 210 }, area), { x: 100, y: 50, width: 360, height: 210 }, 'fora, à esquerda e em cima: encosta na borda');
  assert.deepEqual(dock.fitInside({ x: 0, y: 0, width: 2000, height: 1000 }, area), area, 'maior que o jogo: encolhe');
  // Redimensionar passando da esquerda não empurra o lado direito.
  assert.deepEqual(dock.clipInside({ x: 40, y: 200, width: 460, height: 300 }, area), { x: 100, y: 200, width: 400, height: 300 });
  assert.deepEqual(dock.clipInside({ x: 1000, y: 600, width: 900, height: 900 }, area), { x: 1000, y: 600, width: 380, height: 170 });
});
test('guia: pedir outro com a janela aberta troca o guia atual', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../src/renderer/guide.js'), 'utf8');
  assert.match(src, /addEventListener\('hashchange'/, 'só o # muda ao pedir outro guia: a página não recarrega');
});
test('Ctrl+Alt+I abre as dicas em qualquer modo e não pode virar atalho do usuário', () => {
  const ctx = { toggleCombo: 'Ctrl+Alt+F', exitCombo: 'Ctrl+Alt+Shift+P', capturing: false, blockAltSpace: true };
  const e = { type: 'keyDown', code: 'KeyI', control: true, alt: true };
  assert.equal(decideKey(e, { ...ctx, locked: false }), 'open-tips');
  assert.equal(decideKey(e, { ...ctx, locked: true }), 'open-tips');
  assert.equal(decideKey(e, { ...ctx, locked: false, capturing: true }), 'pass');
  assert.equal(combo.validate('Ctrl+Alt+I').ok, false);
});
test('opacidade: guias começam em 75%, valores fora de 0,3–1 ignorados; botão de dicas a descobrir', () => {
  const d = settings.sanitize({});
  assert.equal(d.guideOpacity, 0.75);
  assert.equal(d.tipsDiscovered, false);
  assert.equal(settings.sanitize({ version: 4, guideOpacity: 0.8 }).guideOpacity, 0.8);
  assert.equal(settings.sanitize({ version: 4, guideOpacity: 0.1 }).guideOpacity, 0.75);
  assert.equal(settings.sanitize({ version: 4, guideOpacity: 'x' }).guideOpacity, 0.75);
  assert.equal(settings.sanitize({ version: 3, guideOpacity: 0.5 }).guideOpacity, 0.75, 'quem tinha o padrão antigo (50%) passa para 75%');
  assert.equal(settings.sanitize({ version: 3, guideOpacity: 0.5 }).version, 6);
  assert.equal(settings.sanitize({ tipsDiscovered: true }).tipsDiscovered, true);
});
test('posição do guia: guardada se válida, descartada se lixo', () => {
  assert.deepEqual(settings.sanitize({ guideBounds: { x: 10, y: 20, width: 300, height: 320 } }).guideBounds, { x: 10, y: 20, width: 300, height: 320 });
  assert.equal(settings.sanitize({ guideBounds: { x: 10, y: 20, width: 50, height: 50 } }).guideBounds, null);
  assert.equal(settings.sanitize({ guideBounds: 'x' }).guideBounds, null);
});
