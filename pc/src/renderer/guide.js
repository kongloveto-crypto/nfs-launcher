(() => {
  'use strict';
  // Guia passo a passo: mostra uma etapa por vez ("Feito" avança) ou a lista toda ("Ver tudo"), em PT ou EN.
  // A altura da janela se ajusta ao texto de cada passo. O progresso de cada guia fica guardado neste PC.
  const $ = (id) => document.getElementById(id);
  const T = window.Tips;
  let lang = T.getLang();
  let C = T.build(lang);
  let guideId = (C.GUIDES.find((g) => g.id === location.hash.slice(1)) || C.GUIDES[0]).id;
  const guide = () => C.GUIDES.find((g) => g.id === guideId);
  let steps = T.guideSteps(guide());
  let cur = 0;
  let listMode = false;

  // Progresso: continua só no MESMO guia (fechar/recolher e abrir de novo). Trocar de guia recomeça do passo 1.
  // O progresso é o mesmo nos dois idiomas (mesmos passos).
  const key = (id) => `nfsu2-guide:${id}`;
  const LAST = 'nfsu2-guide:last';
  const load = (id) => { try { return Math.max(0, Math.min(steps.length, Number(localStorage.getItem(key(id))) || 0)); } catch { return 0; } };
  const save = () => { try { localStorage.setItem(key(guideId), String(cur)); localStorage.setItem(LAST, guideId); } catch { /* sem armazenamento: só não lembra */ } };
  const lastGuide = () => { try { return localStorage.getItem(LAST); } catch { return null; } };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };

  // Altura certa para o conteúdo atual (barra de título + ferramentas + passo ou lista).
  let fitQueued = false;
  function fit() {
    if (fitQueued) return;
    fitQueued = true;
    requestAnimationFrame(() => {
      fitQueued = false;
      const chrome = document.querySelector('.titlebar').offsetHeight + document.querySelector('.toolbar').offsetHeight + 2;
      const body = listMode ? $('g-list').scrollHeight : $('g-step').offsetHeight;
      const need = chrome + body;
      if (Math.abs(need - window.innerHeight) > 1) window.panel.setSize(NaN, need);
    });
  }
  new ResizeObserver(fit).observe(document.body); // largura mudou -> o texto quebra diferente -> nova altura

  function renderPick() {
    // Só os guias do mesmo assunto (Tuning AE86 ou Glitches), com nomes curtos.
    $('g-pick').replaceChildren(...C.GUIDES.filter((g) => g.group === guide().group).map((g) => {
      const b = el('button', '', g.short);
      b.title = g.title;
      b.setAttribute('aria-pressed', String(g.id === guideId));
      b.onclick = () => select(g.id);
      return b;
    }));
  }
  function select(id) {
    if (id === guideId) return;
    guideId = id; steps = T.guideSteps(guide()); cur = 0; save(); // outro guia: recomeça do zero
    history.replaceState(null, '', `${location.search}#${id}`);
    render();
  }

  function renderStep() {
    const U = C.UI;
    const end = cur >= steps.length;
    const s = steps[Math.min(cur, steps.length - 1)];
    const numbered = steps.filter((x) => !x.note).length;
    const doneNumbered = steps.slice(0, cur).filter((x) => !x.note).length;
    $('g-part').textContent = end ? U.finished : s.part;
    $('g-count').textContent = end ? `${numbered}/${numbered}` : s.note ? U.attention : `${doneNumbered + 1}/${numbered}`;
    $('g-bar').style.width = `${Math.round((cur / steps.length) * 100)}%`;
    const t = $('g-text');
    t.className = `text${end ? ' end' : s.note ? ' note' : ''}`;
    t.textContent = end ? (guide().end || (guide().group === 'glitch' ? U.endGlitch : U.endTune)) : s.text;
    $('g-prev').disabled = cur === 0;
    $('g-done').textContent = end ? U.restart : s.note ? U.gotIt : U.done;
    // No fim, se houver próximo guia (Peças -> Circuito -> Arrancada -> glitch), ele vira o botão principal.
    const next = end && guide().next;
    $('g-next').hidden = !next;
    $('g-next').textContent = !next ? '' : `${guide().nextLabel} ›`;
    $('g-done').classList.toggle('accent', !next);
  }
  function renderList() {
    const out = [];
    let part = null;
    steps.forEach((s, i) => {
      if (s.part !== part) { part = s.part; out.push(el('h4', '', part)); }
      const it = el('div', `item${i < cur ? ' done' : ''}${i === cur ? ' now' : ''}${s.note ? ' note' : ''}`);
      it.append(el('span', 'n', i < cur ? '✓' : s.note ? '!' : String(s.n)), el('span', '', s.text));
      it.title = C.UI.jump;
      it.onclick = () => { cur = i; save(); listMode = false; render(); };
      out.push(it);
    });
    $('g-list').replaceChildren(...out);
    const now = $('g-list').querySelector('.now');
    if (now) now.scrollIntoView({ block: 'center' });
  }
  function render() {
    const U = C.UI;
    document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
    $('g-title').textContent = guide().title; // o assunto (AE86/Glitches) já aparece nos botões de escolha
    $('g-title').title = `${C.GROUP_TITLES[guide().group]} — ${guide().title}`;
    document.title = guide().title;
    $('g-mode').textContent = listMode ? U.stepByStep : U.seeAll;
    $('g-tips').textContent = U.toTips;
    $('g-tips').title = U.toTipsTitle;
    $('g-lang').textContent = lang === 'en' ? 'PT' : 'EN';
    $('g-prev').textContent = U.prev;
    $('p-dock').title = U.dock;
    $('p-close').title = U.close;
    $('p-op').parentElement.title = U.opacity;
    $('p-grip').title = U.widthGrip;
    $('g-font-dn').title = U.fontDown;
    $('g-font-up').title = U.fontUp;
    $('g-step').hidden = listMode;
    $('g-list').hidden = !listMode;
    renderPick();
    if (listMode) renderList(); else renderStep();
    fit();
  }
  function useLang(l) {
    lang = l; C = T.build(l); steps = T.guideSteps(guide());
    render();
  }

  $('g-done').onclick = () => { cur = cur >= steps.length ? 0 : cur + 1; save(); render(); };
  $('g-prev').onclick = () => { if (cur > 0) { cur -= 1; save(); render(); } };
  $('g-mode').onclick = () => { listMode = !listMode; render(); };
  $('g-next').onclick = () => { const n = guide().next; if (n) select(n); };
  $('g-tips').onclick = () => window.panel.tips();
  $('g-lang').onclick = () => { const l = lang === 'en' ? 'pt' : 'en'; T.setLang(l); useLang(l); };
  // Tamanho da letra (A− / A+): a altura da janela acompanha o texto.
  const useFont = (v) => { T.applyFont(document, v); fit(); };
  $('g-font-dn').onclick = () => useFont(T.setFont(T.getFont() - T.FONT.step));
  $('g-font-up').onclick = () => useFont(T.setFont(T.getFont() + T.FONT.step));
  T.applyFont(document, T.getFont());
  // Idioma ou letra trocados na tela de dicas: acompanha.
  window.addEventListener('storage', (e) => {
    if (e.key === T.LANG_KEY && T.getLang() !== lang) useLang(T.getLang());
    if (e.key === T.FONT_KEY) useFont(T.getFont());
  });

  // Outro guia pedido nas Dicas com esta janela já aberta: troca aqui mesmo (só o # do endereço muda, a página não recarrega).
  window.addEventListener('hashchange', () => {
    const g = C.GUIDES.find((x) => x.id === location.hash.slice(1));
    if (g && g.id !== guideId) { listMode = false; select(g.id); }
  });

  cur = lastGuide() === guideId ? load(guideId) : 0; // abriu outro guia pelas Dicas: também recomeça
  save();
  render();
})();
