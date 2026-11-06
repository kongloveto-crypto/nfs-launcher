(() => {
  'use strict';
  // Tela inicial do app de celular. Fala com o app pela ponte `launcher` (Java). Os textos das dicas e os sons vêm do
  // app de PC (os mesmos arquivos), e o idioma/letra ficam no armazenamento das páginas locais, como no PC.
  const $ = (id) => document.getElementById(id);
  const api = window.launcher;
  const T = window.Tips;
  let st = JSON.parse(api.state());
  let lang = st.lang;
  let sel = st.game;
  let screen = 'home';
  let tipsTab = 'ae86';
  const SCREENS = ['home', 'settings', 'tips', 'loading', 'error'];
  const t = (pt, en) => (lang === 'en' ? en : pt);
  const NAMES = { pt: 'Português', en: 'English' };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const info = (id) => st.games.find((g) => g.id === id) || st.games[0];

  function toast(msg) {
    const n = $('toast'); n.textContent = msg; n.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { n.hidden = true; }, 3500);
  }
  function chooseLang(l) { if (l === lang) return; T.setLang(l); api.setLang(l); }
  function langButtons(box) {
    box.replaceChildren(...T.LANGS.map((l) => {
      const b = el('button', '', NAMES[l]);
      b.setAttribute('aria-pressed', String(l === lang));
      b.onclick = () => chooseLang(l);
      return b;
    }));
  }

  // Personalização: fundo e capa escolhidos pelo jogador (imagens já refeitas pelo app, como data:).
  let customImgs = {};
  let customRev = -1;
  let customKey = '';
  function loadCustom() {
    if (st.customRev === customRev) return;
    customRev = st.customRev;
    customKey = '';
    customImgs = {};
    for (const g of st.games) {
      customImgs[g.id] = {};
      for (const kind of ['bg', 'disc']) {
        if ((st.custom[g.id] || {})[kind]) customImgs[g.id][kind] = api.customImage(g.id, kind);
      }
    }
  }
  const discOf = (g) => (customImgs[g.id] || {}).disc || g.disc;
  // O fundo próprio substitui a imagem do jogo (o escurecido por cima continua, para o texto ficar legível).
  function applyBg() {
    document.body.dataset.game = sel;
    const bg = (customImgs[sel] || {}).bg;
    if (bg) document.body.style.setProperty('--bgimg', `url("${bg}")`);
    else document.body.style.removeProperty('--bgimg');
  }

  function renderHome() {
    langButtons($('home-lang'));
    $('tagline').textContent = t('Escolha o jogo e toque em START', 'Pick the game and tap START');
    const box = $('games');
    if (box.children.length !== st.games.length) {
      box.replaceChildren(...st.games.map((g) => {
        const b = el('button', 'disc');
        b.dataset.id = g.id;
        const img = el('img'); img.alt = '';
        b.append(img, el('span', 'disc-name', g.short));
        b.onclick = () => { sel = g.id; renderHome(); };
        return b;
      }));
    }
    for (const b of box.children) {
      const g = info(b.dataset.id);
      const img = b.querySelector('img');
      if (img.getAttribute('src') !== discOf(g)) img.src = discOf(g);
      b.setAttribute('aria-pressed', String(g.id === sel));
    }
    applyBg();
    $('btn-start').textContent = 'START';
    $('btn-tips').textContent = t('Dicas', 'Tips');
    $('btn-tips').hidden = !info(sel).tips;
    $('btn-saves').textContent = t('Meus saves', 'My saves');
    $('btn-saves').hidden = sel !== 'nfsu2'; // só o NFSU2 tem cópia do save
    $('btn-settings').textContent = t('Configurações', 'Settings');
    $('btn-quit').textContent = t('Fechar', 'Close');
    $('versions').textContent = `v${st.version}`;
    renderUpdate();
    const gb = st.lowDiskGb;
    $('disk-box').hidden = gb === undefined;
    if (gb !== undefined) $('disk-text').textContent = t(`Pouco espaço no celular: ${String(gb).replace('.', ',')} GB livres. O jogo pode precisar de até 3 GB para baixar e de espaço para salvar.`, `Low storage on this phone: ${gb} GB free. The game may need up to 3 GB to download and room to save.`);
  }

  // Atualizações: o botão fica na tela inicial sempre que a pasta de versões tem um APK mais novo.
  function renderUpdate() {
    const u = st.update || {};
    $('update-box').hidden = u.status !== 'new';
    if (u.status === 'new') $('update-text').textContent = t(`Nova versão ${u.version} disponível (você tem a ${st.version}).`, `Version ${u.version} is available (you have ${st.version}).`);
    $('update-get').textContent = t('Baixar', 'Download');
    $('update-status').textContent = {
      checking: t('Verificando…', 'Checking…'),
      new: t(`Versão ${u.version} disponível!`, `Version ${u.version} available!`),
      none: t(`Você já tem a versão mais nova (${st.version}).`, `You have the latest version (${st.version}).`),
      error: t('Não deu para verificar agora (sem internet?).', 'Could not check now (no internet?).'),
    }[u.status] || t(`Versão instalada: ${st.version}`, `Installed version: ${st.version}`);
    $('b-update').disabled = u.status === 'checking';
  }

  function renderCustom() {
    const key = `${lang}|${customRev}`;
    if (key === customKey) return;
    customKey = key;
    $('custom-list').replaceChildren(...st.games.map((g) => {
      const row = el('div', 'custom-row');
      row.append(el('b', 'custom-name', g.short));
      for (const kind of ['bg', 'disc']) {
        const cell = el('div', 'custom-cell');
        const thumb = el('img', kind === 'bg' ? 'thumb-bg' : 'thumb-disc');
        thumb.alt = '';
        thumb.src = (customImgs[g.id] || {})[kind] || (kind === 'disc' ? g.disc : `bg/${g.id}.jpg`);
        const pick = el('button', 'small', kind === 'bg' ? t('Trocar fundo', 'Change background') : t('Trocar capa', 'Change cover'));
        pick.onclick = () => api.pickImage(g.id, kind);
        const reset = el('button', 'small', t('Padrão', 'Default'));
        reset.disabled = !(st.custom[g.id] || {})[kind];
        reset.onclick = () => api.resetImage(g.id, kind);
        cell.append(thumb, pick, reset);
        row.append(cell);
      }
      return row;
    }));
  }

  function renderSettings() {
    $('set-h').textContent = t('Configurações', 'Settings');
    langButtons($('set-lang'));
    $('set-game-h').textContent = t('Jogo', 'Game');
    $('s-bubble').checked = !!st.bubble;
    $('s-bubble-l').textContent = t('Bolha por cima do jogo (guia, reiniciar e voltar ao início). Desligada = o mais leve possível.',
      'Bubble over the game (guide, restart and back to home). Off = as light as possible.');
    $('set-custom-h').textContent = t('Personalização', 'Personalization');
    $('custom-note').textContent = t('Troque o fundo da tela inicial e a capa (o CD) de cada jogo por uma imagem PNG ou JPG do seu celular. A capa fica redonda: o app usa o quadrado do meio da imagem. “Padrão” volta à imagem original.',
      'Change the home background and the cover (the CD) of each game to a PNG or JPG image from your phone. The cover is round: the app uses the square in the middle of the image. “Default” goes back to the original image.');
    $('set-update-h').textContent = t('Atualizações', 'Updates');
    $('update-note').textContent = t('Quando houver versão nova, o botão de baixar aparece na tela inicial. Nada é baixado ou instalado sozinho e nada do seu celular é enviado.',
      'When there is a new version, the download button shows on the home screen. Nothing is downloaded or installed by itself and nothing from your phone is sent.');
    $('b-update').textContent = t('Verificar agora', 'Check now');
    $('b-update-open').textContent = t('Abrir a pasta de versões', 'Open the versions folder');
    $('set-saves-h').textContent = t('Cópias do save (NFSU2)', 'Save copies (NFSU2)');
    $('saves-note').textContent = t('Ao abrir, o app guarda uma cópia do seu save em Download/NFS Launcher, só se ele mudou. Ficam as 2 últimas versões e nada é enviado. O app nunca coloca uma cópia de volta sozinho. Só restaure se perdeu o save: a cópia pode estar mais antiga que o seu jogo e substitui o que estiver nele. Para voltar: no jogo, em Jogos salvos > Restaurar, escolha o arquivo mais novo da pasta.',
      'When it opens, the app keeps a copy of your save in Download/NFS Launcher, only if it changed. The last 2 versions stay and nothing is sent. The app never puts a copy back by itself. Only restore if you lost your save: a copy may be older than your game and replaces what is in it. To bring one back: in the game, under Saved games > Restore, pick the newest file in the folder.');
    $('b-saves-open').textContent = t('Abrir a pasta das cópias', 'Open the copies folder');
    $('saves-status').textContent = st.lastCopy
      ? t(`Última cópia: ${new Date(st.lastCopy).toLocaleString('pt-BR')}`, `Last copy: ${new Date(st.lastCopy).toLocaleString('en-US')}`)
      : t('Nenhuma cópia ainda: ela é feita ao abrir o app, depois de você salvar no jogo.', 'No copy yet: it is made when the app opens, after you save in the game.');
    $('advanced-h').textContent = t('Avançado', 'Advanced');
    $('set-perf-h').textContent = t('Desempenho', 'Performance');
    $('s-prepareGame').checked = !!st.prepareGame;
    $('s-prepareGame-l').textContent = t('Preparar o jogo ao carregar: otimiza o jogo todo no início, não durante a corrida. Pesa mais nos primeiros segundos e pode reduzir engasgos depois',
      'Prepare the game while loading: optimizes the whole game at the start, not during the race. Heavier in the first seconds and may reduce stutters later');
    $('tex-sec').hidden = !st.texAvail;
    $('set-tex-h').textContent = t('Texturas (NFSU2)', 'Textures (NFSU2)');
    $('s-hdTextures').checked = !!st.hdTextures;
    $('s-hdTextures-l').textContent = t('Texturas melhores: asfalto, prédios, árvores e céu do mod NextGen, com até 2x o tamanho das originais. Em celular fraco, desligue se o jogo ficar lento. O app liga o mapa detalhado do jogo, por onde elas entram. Vale na próxima vez que o jogo abrir',
      'Better textures: asphalt, buildings, trees and sky from the NextGen mod, up to 2x the size of the originals. On a weak phone, turn it off if the game gets slow. The app turns on the game\'s detailed map, which is how they come in. Applies the next time the game opens');
    $('set-maint-h').textContent = t('Manutenção', 'Maintenance');
    $('maint-note').textContent = t('Limpar o cache fica nos ajustes do Android, em Armazenamento, e não toca nos seus saves. Atenção: nunca use “Limpar dados” ali: ele apaga o login, as configurações e os saves do jogo neste app.',
      'Clearing the cache is in the Android settings, under Storage, and does not touch your saves. Warning: never use “Clear data” there: it erases the login, settings and game saves in this app.');
    $('b-app-settings').textContent = t('Abrir os ajustes do app', 'Open app settings');
    $('s-back').textContent = t('Voltar', 'Back');
    renderCustom();
    renderUpdate();
  }

  function renderTips() {
    const C = T.build(lang);
    $('tips-h').textContent = C.UI.tips;
    $('t-back').textContent = C.UI.back;
    $('tf-dn').title = C.UI.fontDown; $('tf-up').title = C.UI.fontUp;
    langButtons($('tips-lang'));
    const tabs = C.TABS;
    $('tips-tabs').replaceChildren(...tabs.map((tb) => {
      const b = el('button', '', tb.title);
      b.setAttribute('aria-selected', String(tb.id === tipsTab));
      b.onclick = () => { tipsTab = tb.id; renderTips(); window.scrollTo(0, 0); };
      return b;
    }));
    const tab = tabs.find((x) => x.id === tipsTab) || tabs[0];
    const out = [];
    for (const b of tab.blocks) {
      if (b.h) out.push(el('h3', '', b.h));
      else if (b.p) out.push(el('p', '', b.p));
      else if (b.note) out.push(el('p', 'note', b.note));
      else if (b.guide) { const btn = el('button', 'primary small', C.UI.openGuide); btn.onclick = () => api.openGuide(b.guide); out.push(btn); }
      else if (b.ul || b.ol) { const list = el(b.ul ? 'ul' : 'ol'); list.append(...(b.ul || b.ol).map((x) => el('li', '', x))); out.push(list); }
      else if (b.kv) {
        const tb = el('table', 'kvt');
        tb.append(...b.kv.map(([k, v]) => { const tr = el('tr'); tr.append(el('th', '', k), el('td', '', v)); return tr; }));
        out.push(tb);
      }
    }
    $('tips-body').replaceChildren(...out);
  }

  // Carregando: o CD do jogo girando, igual à tela que continua por cima do jogo até ele aparecer.
  let loadingTimer = null;
  function renderLoading() {
    const g = info(sel);
    $('loading-h').textContent = t('Carregando o jogo…', 'Loading the game…');
    if ($('loading-disc').getAttribute('src') !== discOf(g)) $('loading-disc').src = discOf(g);
    $('loading-name').textContent = g.name;
    $('loading-note').textContent = t('Na primeira vez os arquivos do jogo são baixados; depois ficam guardados neste celular.', 'The first time, the game files are downloaded; after that they stay on this phone.');
    applyBg();
  }

  // Tela de erro: uma frase simples, sem código técnico.
  function renderError() {
    $('err-h').textContent = t('Não foi possível carregar o jogo', 'Could not load the game');
    $('err-detail').textContent = st.dnsFailed
      ? t('Não abriu nem com DNS seguro. Confira sua rede; se continuar, relate o problema à equipe.', 'It did not open even with secure DNS. Check your network; if it continues, report the problem to the team.')
      : {
      offline: t('Parece que você está sem internet. Confira o Wi-Fi ou os dados móveis.', 'It looks like you are offline. Check your Wi-Fi or mobile data.'),
      server: t('O site do jogo está fora do ar agora. Não é problema no seu celular.', 'The game site is down right now. It is not a problem on your phone.'),
      crash: t('O jogo fechou sozinho. Tente de novo; se continuar, feche outros apps e reinicie o celular.', 'The game closed by itself. Try again; if it continues, close other apps and restart your phone.'),
    }[st.error] || t('Não deu para abrir o site do jogo. Confira a internet; o site também pode estar fora do ar.', 'Could not open the game site. Check your internet; the site may also be down.');
    $('err-retrying').textContent = st.error === 'crash' ? '' : t('Tentando reconectar automaticamente a cada 5 segundos.', 'Trying to reconnect automatically every 5 seconds.');
    $('e-retry').textContent = t('Tentar agora', 'Try now');
    $('e-dns').textContent = t('Tentar com DNS seguro', 'Try with secure DNS');
    $('e-dns').hidden = !st.dnsOffer;
    $('e-home').textContent = t('Voltar ao início', 'Back to home');
  }

  function setScreen(s) {
    screen = s;
    for (const id of SCREENS) $(id).hidden = id !== s;
    clearTimeout(loadingTimer);
    if (s === 'loading') loadingTimer = setTimeout(() => { if (screen === 'loading') setScreen('home'); }, 20000);
    window.refresh();
    window.scrollTo(0, 0);
  }

  // Abertura do app: logo por pouco mais de um segundo. Tocar pula.
  let introDone = false;
  function endIntro() { if (!introDone) { introDone = true; $('intro').hidden = true; } }
  function startIntro() {
    if (st.error) { endIntro(); return; } // voltou com erro: sem abertura
    window.Sounds.play('intro');
    $('intro').onanimationend = (e) => { if (e.target === $('intro')) endIntro(); };
    $('intro').onclick = endIntro;
    setTimeout(endIntro, 2000); // garantia, se as animações estiverem desligadas no celular
  }

  // Chamadas pelo app (Java): estado novo, abrindo o jogo, voltando, botão "voltar" do Android.
  window.refresh = () => {
    st = JSON.parse(api.state());
    if (st.lang !== lang) { lang = st.lang; if (T.getLang() !== lang) T.setLang(lang); }
    document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
    window.Sounds.setEnabled(st.sounds);
    loadCustom();
    if (st.error && screen !== 'error') { screen = 'error'; for (const id of SCREENS) $(id).hidden = id !== 'error'; }
    if (!st.error && screen === 'error') { screen = 'home'; for (const id of SCREENS) $(id).hidden = id !== 'home'; }
    renderHome();
    if (screen === 'settings') renderSettings();
    if (screen === 'tips') renderTips();
    if (screen === 'loading') renderLoading();
    if (screen === 'error') renderError();
  };
  window.showLoading = (id) => { if (id) sel = id; setScreen('loading'); };
  window.showHome = () => { if (screen === 'loading') setScreen('home'); };
  window.goBack = () => {
    if (screen === 'error') { api.clearError(); return 'ok'; }
    if (screen === 'tips' || screen === 'settings') { setScreen('home'); return 'ok'; }
    return 'exit';
  };
  // App em segundo plano ou com o jogo aberto: sem áudio local (o mesmo cuidado do PC).
  window.audioOn = (on) => { window.Sounds.setEnabled(on && st.sounds); };

  $('btn-start').onclick = () => api.start(sel);
  $('btn-tips').onclick = () => setScreen('tips');
  const openSaves = () => { api.openSaves(); toast(t('Só restaure se perdeu o save: no jogo, Jogos salvos > Restaurar.', 'Only restore if you lost your save: in the game, Saved games > Restore.')); };
  $('btn-saves').onclick = openSaves;
  $('b-saves-open').onclick = openSaves;
  $('btn-settings').onclick = () => setScreen('settings');
  $('update-get').onclick = () => api.openUpdates();
  $('btn-quit').onclick = () => api.quit();
  $('t-back').onclick = () => window.goBack();
  $('s-back').onclick = () => window.goBack();
  $('b-update').onclick = () => api.checkUpdate();
  $('b-update-open').onclick = () => api.openUpdates();
  $('b-app-settings').onclick = () => api.openAppSettings();
  $('e-retry').onclick = () => api.retry();
  $('e-dns').onclick = () => api.trySecureDns();
  $('e-home').onclick = () => api.clearError();
  for (const key of ['bubble', 'prepareGame', 'hdTextures']) {
    $(`s-${key}`).onchange = (e) => {
      api.setOption(key, e.target.checked);
      if (key !== 'bubble') toast(t('Vale na próxima vez que o jogo abrir.', 'Applies the next time the game opens.'));
    };
  }
  // A letra vale para as dicas daqui e para o guia nativo (bolha), que lê a preferência do app.
  const font = (d) => { const f = T.setFont(T.getFont() + d); T.applyFont(document, f); api.setFont(f); };
  $('tf-dn').onclick = () => font(-T.FONT.step);
  $('tf-up').onclick = () => font(T.FONT.step);
  T.applyFont(document, T.getFont());
  if (T.getLang() !== lang) T.setLang(lang); // a preferência do app vale também para os guias
  window.Sounds.attach(document);
  window.refresh();
  startIntro();
})();
