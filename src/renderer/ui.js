(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const api = window.launcher;
  const BOOLS = ['startFullscreen', 'highPriority', 'prepareGame', 'lighterGpu', 'unblockGpu', 'newDrawing', 'antiAlias', 'imageFilter', 'hdTextures'];
  let state = null;
  let capturingFor = null;
  let gpuResult = null;

  // Idioma do app (PT/EN): vem das preferências (settings.json) e é o mesmo das dicas e dos guias.
  // Textos fixos: i18n.js troca os do ui.html. Textos montados aqui: t('português', 'english').
  let lang = 'pt';
  const t = (pt, en) => (lang === 'en' ? en : pt);
  const LANG_NAMES = { pt: 'Português', en: 'English' };
  function chooseLang(l) {
    if (!window.Tips.LANGS.includes(l) || l === lang) return;
    window.Tips.setLang(l); // a janela do guia acompanha
    api.setSetting('lang', l); // o processo principal (avisos, confirmações) também; o estado novo chega por onState
  }
  function useLang(l) {
    lang = window.Tips.LANGS.includes(l) ? l : 'pt';
    if (window.Tips.getLang() !== lang) window.Tips.setLang(lang);
    window.I18n.apply(lang);
    renderLangPickers();
    renderChip();
    if (state && state.screen === 'tips') renderTips();
    if (state && state.screen === 'settings') renderGpuDetail();
  }
  function renderLangPickers() {
    for (const id of ['home-lang', 'set-lang']) {
      $(id).replaceChildren(...window.Tips.LANGS.map((l) => {
        const b = el('button', '', LANG_NAMES[l]);
        b.setAttribute('aria-pressed', String(l === lang));
        b.onclick = () => chooseLang(l);
        return b;
      }));
    }
  }
  // O idioma também pode ser trocado na janela do guia: as páginas locais compartilham a preferência.
  window.addEventListener('storage', (e) => {
    if (e.key === window.Tips.FONT_KEY) window.Tips.applyFont(document, window.Tips.getFont()); // A−/A+ no guia
    if (e.key !== window.Tips.LANG_KEY) return;
    const l = window.Tips.getLang();
    if (l !== lang) api.setSetting('lang', l);
  });
  // Tamanho da letra das dicas (o mesmo do guia flutuante).
  window.Tips.applyFont(document, window.Tips.getFont());
  $('tf-dn').onclick = () => window.Tips.applyFont(document, window.Tips.setFont(window.Tips.getFont() - window.Tips.FONT.step));
  $('tf-up').onclick = () => window.Tips.applyFont(document, window.Tips.setFont(window.Tips.getFont() + window.Tips.FONT.step));

  // Teste real de WebGPU: pede um adaptador de alto desempenho e cria um dispositivo.
  async function testWebGPU() {
    const r = { supported: false, software: false, adapter: '', detail: '' };
    if (!('gpu' in navigator)) { r.detail = t('WebGPU indisponível neste PC', 'WebGPU is not available on this PC'); return r; }
    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) { r.detail = t('Nenhum adaptador WebGPU disponível (driver ou GPU incompatível)', 'No WebGPU adapter available (incompatible driver or GPU)'); return r; }
      const info = adapter.info || {};
      r.software = !!info.isFallbackAdapter;
      r.adapter = [info.vendor, info.architecture, info.device, info.description].filter(Boolean).join(' · ') || t('(sem descrição)', '(no description)');
      const dev = await adapter.requestDevice();
      r.maxTexture = adapter.limits.maxTextureDimension2D;
      r.features = adapter.features.size;
      dev.destroy();
      r.supported = true;
    } catch (err) {
      r.detail = String((err && err.message) || err);
    }
    return r;
  }

  let dx11Failed = false;
  function renderChip() {
    const chip = $('gpu-chip');
    const label = chip.querySelector('span');
    chip.className = 'chip';
    // Na tela inicial só aparece se houver problema; o detalhe fica em Configurações > WebGPU e GPU.
    // O modo DirectX 11 só é oferecido a quem tem problema; quem está nele continua vendo o aviso, para poder desfazer.
    const problem = !!gpuResult && (!gpuResult.supported || gpuResult.software);
    const unblockOn = !!(state && state.settings.unblockGpu);
    chip.hidden = !gpuResult || (!problem && !unblockOn);
    $('unblock-row').hidden = !problem && !unblockOn;
    $('gpu-unblock').hidden = !problem && !unblockOn;
    $('gpu-unblock').textContent = unblockOn ? t('Desfazer e reabrir', 'Undo and reopen') : t('Tentar modo DirectX 11', 'Try DirectX 11 mode');
    if (!gpuResult) { label.textContent = t('Verificando WebGPU…', 'Checking WebGPU…'); return; }
    if (!problem && unblockOn) {
      chip.classList.add('caution'); label.textContent = t('Modo DirectX 11 ligado, para placa sem DirectX 12, sem texturas HD e sem opções extras. Se a imagem der erro, desfaça.', 'DirectX 11 mode is on, for graphics without DirectX 12, without HD textures or extra options. If the picture has errors, undo it.');
    } else if (gpuResult.supported && !gpuResult.software) {
      chip.classList.add('ok'); label.textContent = t(`WebGPU disponível — ${gpuResult.adapter}`, `WebGPU available — ${gpuResult.adapter}`);
    } else if (gpuResult.supported) {
      chip.classList.add('caution'); label.textContent = t('WebGPU em modo software (sem GPU real) — atualize o driver', 'WebGPU in software mode (no real GPU) — update the driver');
    } else {
      chip.classList.add('bad');
      label.textContent = t(`WebGPU indisponível — ${gpuResult.detail}. Atualize o driver da placa de vídeo (NVIDIA App, AMD Software: Adrenalin ou Intel Driver & Support Assistant). Esta placa pode não ter DirectX 12.`,
        `WebGPU unavailable — ${gpuResult.detail}. Update the graphics driver (NVIDIA App, AMD Software: Adrenalin or Intel Driver & Support Assistant). This graphics card may not have DirectX 12.`);
    }
    if (dx11Failed) label.textContent += t(' O modo DirectX 11 também não funcionou nesta placa.', ' DirectX 11 mode did not work on this graphics card either.');
  }

  async function renderGpuDetail() {
    const main = await api.gpuStatus();
    const g = gpuResult;
    const rows = [];
    rows.push(['WebGPU', !g ? '…' : g.supported ? (g.software ? t('ativo, porém em SOFTWARE', 'active, but in SOFTWARE') : t('disponível (GPU real)', 'available (real GPU)')) : t(`indisponível — ${g.detail}`, `unavailable — ${g.detail}`)]);
    if (g && g.adapter) rows.push([t('Adaptador', 'Adapter'), g.adapter]);
    const dpr = window.devicePixelRatio;
    rows.push([t('Tela', 'Screen'), t(`${screen.width}×${screen.height} × escala ${dpr} = ${Math.round(screen.width * dpr)}×${Math.round(screen.height * dpr)} pixels reais`,
      `${screen.width}×${screen.height} × scale ${dpr} = ${Math.round(screen.width * dpr)}×${Math.round(screen.height * dpr)} real pixels`)]);
    if (g && g.maxTexture) rows.push([t('Limite de textura', 'Texture limit'), t(`${g.maxTexture}px por lado na sua GPU (o jogo usa no máximo 8192; não é a resolução do jogo)`,
      `${g.maxTexture}px per side on your GPU (the game uses at most 8192; this is not the game resolution)`)]);
    if (main && main.features) {
      const f = main.features;
      rows.push(['Status', ['webgpu', 'webgl2', 'gpu_compositing', 'rasterization'].filter((k) => k in f).map((k) => `${k}: ${f[k]}`).join(' · ') || 'n/d']);
    }
    if (main && main.devices && main.devices.length) {
      const names = { 0x10de: 'NVIDIA', 0x1002: 'AMD', 0x8086: 'Intel', 0x1414: t('Microsoft (adaptador básico)', 'Microsoft (basic adapter)') };
      rows.push(['GPUs', main.devices.map((d) => `${names[d.vendorId] || '0x' + (d.vendorId || 0).toString(16)}${d.active ? t(' (ativa)', ' (active)') : ''}`).join(', ')]);
    }
    rows.push(['FPS', main && main.uncapped ? t('sem VSync e sem limite (--uncapped): pode causar tearing', 'no VSync and no cap (--uncapped): may cause tearing')
      : t('sincronizado com o monitor (VSync)', 'synced to the monitor (VSync)')]);
    $('gpu-detail').replaceChildren(...rows.flatMap(([k, v]) => {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      return [dt, dd];
    }));
  }


  // Tela de dicas: abas montadas a partir de tips.js (só texto; nada vira HTML), no idioma do app.
  let tipsTab = 'ae86';
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function renderTips() {
    const C = window.Tips.build(lang);
    const tabs = C.TABS;
    $('tips-h').textContent = C.UI.tips;
    $('tips-hint').textContent = C.UI.keysHint;
    $('t-back').textContent = C.UI.back;
    $('tips-lang').title = C.UI.language;
    $('tips-lang').replaceChildren(...window.Tips.LANGS.map((l) => {
      const b = el('button', '', LANG_NAMES[l]);
      b.setAttribute('aria-pressed', String(l === lang));
      b.onclick = () => chooseLang(l);
      return b;
    }));
    $('tips-tabs').replaceChildren(...tabs.map((tb) => {
      const b = el('button', '', tb.title);
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(tb.id === tipsTab));
      b.onclick = () => { tipsTab = tb.id; renderTips(); $('tips').scrollTop = 0; };
      return b;
    }));
    const tab = tabs.find((x) => x.id === tipsTab) || tabs[0];
    const out = [];
    for (const b of tab.blocks) {
      if (b.h) out.push(el('h3', '', b.h));
      else if (b.p) out.push(el('p', '', b.p));
      else if (b.note) out.push(el('p', 'note', b.note));
      else if (b.guide) {
        const btn = el('button', 'primary small', C.UI.openGuide);
        btn.onclick = () => api.openGuide(b.guide);
        out.push(btn);
      }
      else if (b.ul || b.ol) {
        const list = el(b.ul ? 'ul' : 'ol');
        list.append(...(b.ul || b.ol).map((x) => el('li', '', x)));
        out.push(list);
      } else if (b.kv) {
        const tb = el('table', 'kvt');
        tb.append(...b.kv.map(([k, v]) => { const tr = el('tr'); tr.append(el('th', '', k), el('td', '', v)); return tr; }));
        out.push(tb);
      }
    }
    $('tips-body').replaceChildren(...out);
  }

  // Catálogo (tela inicial): um CD por jogo. Clicar escolhe; START abre o escolhido.
  // Começa marcado o último jogo iniciado (o app guarda); na primeira vez, o NFSU2.
  let selGame = null;
  const gameInfo = (id) => (state && state.games.find((g) => g.id === id)) || null;
  function renderGames(s) {
    if (!selGame || !gameInfo(selGame)) selGame = s.settings.game || 'nfsu2';
    const box = $('games');
    if (box.children.length !== s.games.length) {
      box.replaceChildren(...s.games.map((g) => {
        const b = el('button', 'disc');
        b.type = 'button';
        b.dataset.id = g.id;
        b.title = g.name;
        const img = el('img');
        img.src = g.disc; img.alt = ''; img.width = 150; img.height = 150;
        b.append(img, el('span', 'disc-name', g.short), el('span', 'disc-sub'));
        b.onclick = () => { selGame = g.id; render(state); };
        b.ondblclick = () => { selGame = g.id; api.start(selGame); };
        return b;
      }));
    }
    for (const b of box.children) {
      const g = gameInfo(b.dataset.id);
      const src = (customImgs[g.id] || {}).disc || g.disc; // capa escolhida pelo jogador, se houver
      const img = b.querySelector('img');
      if (img.getAttribute('src') !== src) img.src = src;
      b.setAttribute('aria-pressed', String(g.id === selGame));
      b.querySelector('.disc-sub').textContent = s.gameStarted && s.game === g.id ? t('jogando agora', 'playing now') : ' ';
    }
  }

  // Personalização: fundo e capa de cada jogo escolhidos pelo jogador (imagens já refeitas pelo app, como data:).
  let customImgs = {};
  let customRev = -1;   // versão pedida ao processo principal
  let customLoaded = 0; // conta as cargas concluídas (para refazer a lista de miniaturas só quando muda)
  async function loadCustom(s) {
    if (s.customRev === customRev) return;
    customRev = s.customRev;
    customImgs = (await api.customImages()) || {};
    customLoaded++;
    if (state) render(state);
  }
  // O fundo próprio substitui a imagem do tema (o degradê por cima continua, para o texto ficar legível).
  function applyCustomBg() {
    const bg = (customImgs[document.body.dataset.game] || {}).bg;
    if (bg) { document.body.style.setProperty('--bgimg', `url("${bg}")`); document.body.style.setProperty('--bgpos', 'center'); }
    else { document.body.style.removeProperty('--bgimg'); document.body.style.removeProperty('--bgpos'); }
  }
  let customKey = '';
  function renderCustom(s) {
    const key = `${customLoaded}|${lang}|${JSON.stringify(s.custom)}`;
    if (key === customKey) return;
    customKey = key;
    const box = $('custom-list');
    box.replaceChildren(...s.games.map((g) => {
      const row = el('div', 'custom-row');
      row.append(el('b', 'custom-name', g.short));
      for (const kind of ['bg', 'disc']) {
        const cell = el('div', 'custom-cell');
        const thumb = el('img', kind === 'bg' ? 'thumb-bg' : 'thumb-disc');
        thumb.alt = '';
        thumb.src = (customImgs[g.id] || {})[kind] || (kind === 'disc' ? g.disc : `bg/${g.id}.jpg`);
        const own = !!(s.custom[g.id] || {})[kind];
        const pick = el('button', 'small', kind === 'bg' ? t('Trocar fundo…', 'Change background…') : t('Trocar capa…', 'Change cover…'));
        pick.onclick = async () => {
          const r = await api.pickCustom(g.id, kind);
          if (r && r.ok) toast(t('Imagem salva.', 'Image saved.')); else if (r && r.error !== 'Cancelado.') toast(r.error, true);
        };
        const reset = el('button', 'small', t('Padrão', 'Default'));
        reset.disabled = !own;
        reset.title = t('Volta à imagem original', 'Back to the original image');
        reset.onclick = async () => { const r = await api.resetCustom(g.id, kind); if (!(r && r.ok)) toast((r && r.error) || '', true); };
        cell.append(thumb, pick, reset);
        row.append(cell);
      }
      return row;
    }));
  }

  // Janela de texturas (texPack.js): rascunho local com a opção geral e o mod de cada parte; nada vale até "Aplicar",
  // que grava tudo de uma vez e só então pergunta se reinicia o jogo (pedido do Bruno: trocar várias antes do aviso).
  let texDraft = null;
  function texDraftFrom(s) {
    return { on: !!s.settings.hdTextures, parts: { ...((s.texParts && s.texParts.choice) || {}) } };
  }
  function renderTexScreen(s) {
    const tp = s.texParts;
    if (!texDraft) texDraft = texDraftFrom(s);
    $('x-on').checked = texDraft.on;
    $('x-box').hidden = !tp;
    $('x-box').classList.toggle('dim', !texDraft.on);
    const now = texDraftFrom(s);
    $('x-apply').disabled = JSON.stringify(now) === JSON.stringify(texDraft);
    if (!tp) return;
    const names = Object.fromEntries(tp.mods.map((m) => [m.id, m.name]));
    $('x-parts').replaceChildren(...tp.parts.map((p) => {
      const row = el('div', 'tex-row');
      row.append(el('b', '', t(p.pt, p.en)));
      const group = el('div', 'lang');
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', t(p.pt, p.en));
      for (const id of [...p.mods, 'original']) {
        const b = el('button', '', id === 'original' ? t('Original', 'Original') : names[id] || id);
        b.setAttribute('aria-pressed', String(texDraft.parts[p.id] === id));
        b.onclick = () => { texDraft.parts[p.id] = id; renderTexScreen(state); };
        group.append(b);
      }
      row.append(group);
      return row;
    }));
  }
  $('x-on').onchange = () => { if (texDraft) { texDraft.on = $('x-on').checked; renderTexScreen(state); } };
  $('x-cancel').onclick = () => api.back();
  $('x-apply').onclick = async () => {
    if (!texDraft) return;
    const r = await api.applyTextures(texDraft);
    if (!(r && r.ok)) toast((r && r.error) || '', true);
  };
  $('b-tex-parts').onclick = () => api.openTextures();

  // Atualizações: o botão fica na tela inicial sempre que a pasta de versões tem um instalador mais novo.
  function renderUpdate(s) {
    const u = s.update || {};
    $('update-box').hidden = u.status !== 'new';
    if (u.status === 'new') $('update-text').textContent = t(`Nova versão ${u.version} disponível (você tem a ${s.versions.app}).`, `Version ${u.version} is available (you have ${s.versions.app}).`);
    $('update-status').textContent = {
      checking: t('Verificando…', 'Checking…'),
      new: t(`Versão ${u.version} disponível!`, `Version ${u.version} available!`),
      none: t(`Você já tem a versão mais nova (${s.versions.app}).`, `You have the latest version (${s.versions.app}).`),
      error: t('Não deu para verificar agora (sem internet?).', 'Could not check now (no internet?).'),
    }[u.status] || t(`Versão instalada: ${s.versions.app}`, `Installed version: ${s.versions.app}`);
    $('b-update').disabled = u.status === 'checking';
  }

  function renderSaves(s) {
    const gb = s.lowDiskGb;
    $('disk-box').hidden = gb === null;
    if (gb !== null) $('disk-text').textContent = t(`Pouco espaço no disco: ${String(gb).replace('.', ',')} GB livres. O jogo pode precisar de até 3 GB para baixar e de espaço para salvar.`, `Low disk space: ${gb} GB free. The game may need up to 3 GB to download and room to save.`);
    const c = s.saveCopies;
    $('saves-status').textContent = c.count
      ? t(`Última cópia: ${new Date(c.last).toLocaleString('pt-BR')}`, `Last copy: ${new Date(c.last).toLocaleString('en-US')}`)
      : t('Nenhuma cópia ainda: ela é feita ao abrir o app, depois de você salvar no jogo.', 'No copy yet: it is made when the app opens, after you save in the game.');
  }

  // Tela de erro: uma frase simples, sem código técnico.
  function errorText(kind) {
    return {
      offline: t('Parece que você está sem internet. Confira o Wi-Fi ou o cabo.', 'It looks like you are offline. Check your Wi-Fi or cable.'),
      server: t('O site do jogo está fora do ar agora. Não é problema no seu PC.', 'The game site is down right now. It is not a problem on your PC.'),
      crash: t('O jogo fechou sozinho várias vezes. Feche e abra o app; se continuar, atualize o driver da placa de vídeo.', 'The game closed by itself several times. Close and reopen the app; if it continues, update the graphics driver.'),
    }[kind] || t('Não deu para abrir o site do jogo. Confira a internet; o site também pode estar fora do ar.', 'Could not open the game site. Check your internet; the site may also be down.');
  }

  // Abertura do app: logo por pouco mais de um segundo, só quando ele abre na tela inicial. Clique ou tecla pulam.
  let introDone = false;
  function endIntro() { if (!introDone) { introDone = true; $('intro').hidden = true; } }
  function renderIntro(s) {
    if (introDone) return;
    if (s.screen !== 'launcher') { endIntro(); return; }
    if (renderIntro.started) return;
    renderIntro.started = true;
    window.Sounds.play('intro');
    $('intro').onanimationend = (e) => { if (e.target === $('intro')) endIntro(); };
    $('intro').onclick = endIntro;
    window.addEventListener('keydown', endIntro, { once: true });
    setTimeout(endIntro, 2000); // garantia, se a animação estiver desligada no Windows
  }

  // Carregando: o CD do jogo girando, com a capa escolhida pelo jogador, se houver.
  function renderLoading(s) {
    if (s.screen !== 'loading') return;
    const g = gameInfo(s.game) || gameInfo(selGame);
    if (!g) return;
    const src = (customImgs[g.id] || {}).disc || g.disc;
    if ($('loading-disc').getAttribute('src') !== src) $('loading-disc').src = src;
    $('loading-name').textContent = g.name;
  }

  function toast(msg, isErr) {
    const n = $('toast');
    n.textContent = msg; n.className = isErr ? 'toast err' : 'toast'; n.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { n.hidden = true; }, 4500);
  }

  const IMAGE_NAMES = {
    suave: ['Suave', 'Soft'],
    vivido: ['Vívido', 'Vivid'],
    intenso: ['Intenso', 'Intense'],
    nitido: ['Nítido', 'Sharp'],
    vividoNitido: ['Vívido+Nítido', 'Vivid+Sharp'],
  };
  function render(s) {
    state = s;
    if (s.settings.lang && s.settings.lang !== lang) useLang(s.settings.lang);
    document.body.dataset.screen = s.screen;
    // Em janela, a barra do topo fica em todas as telas; os botões dela, só com o jogo aberto. Na tela cheia, botão discreto.
    document.body.classList.toggle('windowed', !s.fullscreen);
    $('corner').hidden = s.fullscreen && s.screen !== 'none';
    for (const id of ['c-home', 'c-reload', 'c-image', 'c-fs']) $(id).hidden = !s.gameStarted;
    const imageName = s.settings.imageFilter ? t(...IMAGE_NAMES[s.settings.imageMode]) : t('Desligado', 'Off');
    $('c-image-name').textContent = imageName;
    $('c-image').classList.toggle('on', !!s.settings.imageFilter);
    const imageTip = t(`Filtro de imagem: ${imageName}. Clique para trocar`, `Picture filter: ${imageName}. Click to change`);
    $('c-image').title = imageTip;
    $('c-image').setAttribute('aria-label', imageTip);
    const open = s.gameStarted && gameInfo(s.game);
    $('bar-name').textContent = open ? open.name : 'NFS Launcher';
    // Até a primeira vez nas dicas: botão de dicas fixo, com rótulo e um brilho curto (só ele no modo protegido).
    $('corner').classList.toggle('discover', s.cornerMode === 'discover');
    // No modo protegido o botão de tela cheia continua (é por ele que o jogador sai); só as configurações somem.
    $('c-set').hidden = s.locked || !s.gameStarted;
    const fsTip = t(`Entrar e sair da tela cheia: ${s.settings.toggleCombo}`, `Enter and leave fullscreen: ${s.settings.toggleCombo}`);
    $('c-fs').title = fsTip;
    $('btn-fs').title = fsTip;
    // Dica piscando no topo quando o jogador sai do jogo em tela cheia (tecla Windows, Alt+Tab) e quando volta.
    const hint = s.screen === 'none' && s.fsHint;
    document.body.classList.toggle('hinting', !!hint);
    $('fs-hint').hidden = !hint;
    if (hint) {
      $('fs-hint').textContent = t(`Para sair da tela cheia: ${s.settings.toggleCombo} (ou o botão ⛶ aqui em cima)`,
        `To leave fullscreen: ${s.settings.toggleCombo} (or the ⛶ button up here)`);
    }
    const was = document.body.dataset.shown;
    for (const id of ['launcher', 'settings', 'error', 'loading', 'tips', 'textures']) $(id).hidden = s.screen !== id;
    if (s.screen === 'tips') {
      if (was !== 'tips') renderTips();
    }
    // Janela de texturas: rascunho novo a cada vez que abre (o que não foi aplicado some ao voltar).
    if (s.screen === 'textures') { if (was !== 'textures') texDraft = null; renderTexScreen(s); } else texDraft = null;
    document.body.dataset.shown = s.screen;
    // Foco no botão principal de cada tela: Enter já funciona sem usar o mouse.
    if (was !== s.screen) {
      const target = { launcher: 'btn-start', error: 'e-retry' }[s.screen];
      if (target) $(target).focus({ preventScroll: true });
      if (s.screen === 'settings') $('settings').scrollTop = 0;
      if (s.screen === 'tips') $('tips').scrollTop = 0;
    }
    $('btn-fs').textContent = s.fullscreen ? t('Sair da tela cheia', 'Leave fullscreen') : t('Tela cheia', 'Fullscreen');
    renderGames(s);
    // Tema do fundo: na tela inicial segue o CD escolhido; nas demais, o jogo aberto (ou o escolhido).
    document.body.dataset.game = (s.screen === 'launcher' ? selGame : (s.game || selGame)) || 'nfsu2';
    applyCustomBg();
    $('btn-start').textContent = s.gameStarted && selGame === s.game ? t('VOLTAR AO JOGO', 'BACK TO GAME') : 'START';
    // Dicas e guias são do NFSU2: somem com outro jogo escolhido/aberto.
    $('btn-tips').hidden = !(gameInfo(selGame) || {}).tips;
    $('btn-saves').hidden = selGame !== 'nfsu2'; // só o NFSU2 tem cópia do save
    $('c-tips').hidden = !s.tipsOn || !s.gameStarted;
    // Texturas melhores: só com o NFSU2 aberto e o pacote presente. Colorido quando ligado.
    $('c-tex').hidden = !(s.gameStarted && s.game === 'nfsu2' && s.texturesAvail);
    $('c-tex').classList.toggle('on', !!s.settings.hdTextures);
    const texTip = s.settings.hdTextures ? t('Texturas HD: ligadas. Clique para escolher', 'HD textures: on. Click to choose')
      : t('Texturas HD: desligadas. Clique para escolher', 'HD textures: off. Click to choose');
    $('c-tex').title = texTip;
    $('c-tex').setAttribute('aria-label', texTip);
    $('loading-note').textContent = t('Na primeira vez os arquivos do jogo são baixados; depois ficam guardados neste PC.',
      'The first time, the game files are downloaded; after that they stay on this PC.');
    $('versions').textContent = `v${s.versions.app}`;
    for (const k of BOOLS) $(`s-${k}`).checked = !!s.settings[k];
    $('s-imageMode').value = s.settings.imageMode;
    $('s-imageMode').disabled = !s.settings.imageFilter;
    for (const k of ['toggleCombo', 'exitCombo']) {
      $(`k-${k}`).textContent = s.settings[k];
      $(`b-${k}`).textContent = capturingFor === k ? t('Pressione… (Esc cancela)', 'Press… (Esc cancels)') : t('Alterar', 'Change');
    }
    $('b-back').textContent = s.gameStarted ? t('Voltar ao jogo', 'Back to game') : t('Voltar', 'Back');
    $('b-reload').disabled = !s.gameStarted;
    if (s.connError) {
      $('err-detail').textContent = s.connError.dnsFailed
        ? t('Não abriu nem com DNS seguro. Confira sua rede; se continuar, relate o problema à equipe.', 'It did not open even with secure DNS. Check your network; if it continues, report the problem to the team.')
        : errorText(s.connError.kind);
    }
    $('e-dns').hidden = !(s.connError && s.connError.dnsOffer);
    window.Sounds.setEnabled(s.settings.sounds && s.screen !== 'none');
    renderIntro(s);
    renderLoading(s);
    $('restart-row').hidden = !s.restartNeeded;
    renderChip();
    renderUpdate(s);
    renderSaves(s);
    if (s.screen === 'settings') renderCustom(s);
    $('tex-box').hidden = !s.texParts;
    loadCustom(s);
    $('e-exit').hidden = !s.locked;
    $('e-settings').hidden = s.locked;
  }

  function stopCapture() { capturingFor = null; api.setCapturing(false); if (state) render(state); }
  window.addEventListener('keydown', async (e) => {
    if (!capturingFor) {
      // Esc nas configurações volta (para o jogo, se ele já foi iniciado).
      if (e.code === 'Escape' && state && ['settings', 'tips', 'textures'].includes(state.screen) && !e.ctrlKey && !e.altKey) { e.preventDefault(); api.back(); }
      return;
    }
    e.preventDefault(); e.stopPropagation();
    if (e.code === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey) { stopCapture(); return; }
    const c = window.Combo.fromEvent(e);
    if (!c) return;
    const which = capturingFor;
    const r = await api.setSetting(which, c);
    stopCapture();
    if (r && r.ok) toast(t(`Atalho salvo: ${c}`, `Shortcut saved: ${c}`));
    else toast(window.I18n.comboError(r && r.error, lang) || t('Atalho inválido.', 'Invalid shortcut.'), true);
  }, true);

  $('btn-start').onclick = () => api.start(selGame);
  $('btn-fs').onclick = () => api.toggleFullscreen();
  $('btn-settings').onclick = () => api.openSettings();
  $('btn-quit').onclick = () => api.quit();
  $('c-fs').onclick = () => (state && state.locked ? api.exitProtected() : api.toggleFullscreen());
  $('c-set').onclick = () => api.openSettings();
  $('c-image').onclick = () => api.nextImageMode();
  $('c-tips').onclick = () => api.openTips();
  $('c-tex').onclick = () => api.openTextures();
  $('c-home').onclick = () => api.goHome(); // fecha o jogo aberto e volta aos CDs
  $('c-reload').onclick = () => api.reloadAsk(); // só por clique: as teclas são do jogo
  $('btn-tips').onclick = () => api.openTips();
  $('t-back').onclick = () => api.back();
  $('b-back').onclick = () => api.back();
  $('b-reload').onclick = () => api.reloadAsk();
  $('b-gpu-test').onclick = async () => { gpuResult = null; renderChip(); gpuResult = await testWebGPU(); renderChip(); renderGpuDetail(); };
  $('b-diag').onclick = async () => {
    const r = await api.saveDiagnostics();
    if (r.ok) toast(t(`Relatório salvo: ${r.name}`, `Report saved: ${r.name}`)); else if (r.error !== 'Cancelado.') toast(r.error, true);
  };
  const openSaves = async () => {
    const r = await api.openSaveCopies();
    toast(r.ok ? t('Só restaure se perdeu o save: no jogo, Jogos salvos > Restaurar.', 'Only restore if you lost your save: in the game, Saved games > Restore.') : r.error, !r.ok);
  };
  $('btn-saves').onclick = openSaves;
  $('b-saves-open').onclick = openSaves;
  $('b-restart').onclick = () => api.restart();
  $('gpu-unblock').onclick = async () => { await api.setSetting('unblockGpu', !state.settings.unblockGpu); api.restart(); };
  $('b-cache').onclick = async () => { const r = await api.resetCache(); toast(r.ok ? t('Cache limpo.', 'Cache cleared.') : r.error, !r.ok); };
  const openUpdates = async () => { const r = await api.openUpdates(); if (!(r && r.ok)) toast((r && r.error) || '', true); };
  $('update-get').onclick = openUpdates;
  $('b-update-open').onclick = openUpdates;
  $('b-update').onclick = () => api.checkUpdates(); // o resultado chega pelo estado
  $('e-retry').onclick = () => api.reload();
  $('e-dns').onclick = () => api.trySecureDns();
  $('e-exit').onclick = () => api.exitProtected();
  $('e-settings').onclick = () => api.openSettings();
  $('e-quit').onclick = () => api.quit();
  for (const k of BOOLS) $(`s-${k}`).onchange = (ev) => api.setSetting(k, ev.target.checked);
  $('s-imageMode').onchange = (ev) => api.setSetting('imageMode', ev.target.value);
  for (const k of ['toggleCombo', 'exitCombo']) {
    $(`b-${k}`).onclick = () => { capturingFor = capturingFor === k ? null : k; api.setCapturing(!!capturingFor); render(state); };
  }

  renderLangPickers();
  window.Sounds.attach(document);
  api.onState((s) => { const was = state && state.screen; render(s); if (s.screen === 'settings' && was !== 'settings') renderGpuDetail(); });
  (async () => {
    const s = await api.getState();
    useLang(s.settings.lang || 'pt'); // o idioma salvo vale para tudo (também corrige as dicas, se estavam em outro)
    render(s);
    let result = await testWebGPU();
    // Uma falha passageira do driver não pode tirar do DirectX 12 quem tem: confere de novo antes de decidir.
    if (!result.supported) {
      await new Promise((done) => setTimeout(done, 1500));
      result = await testWebGPU();
    }
    const report = await api.reportGpu({ supported: result.supported, software: result.software });
    if (report && report.action === 'try') return; // o app está reabrindo em DirectX 11
    dx11Failed = !!report && report.action === 'failed';
    gpuResult = result;
    renderChip();
    if (state.screen === 'settings') renderGpuDetail();
  })();
})();
