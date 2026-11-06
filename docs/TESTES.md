# Checklist de testes (Windows 11)

Automatizados: `npm test` (128 testes) e `npm run verify` (27 verificações). Conferir a montagem: `"NFS Launcher.exe" --conferir` sai com 73.

## PC

| # | Teste | Esperado |
|---|---|---|
| 1 | Abrir o app | Logo "NFS Launcher" por pouco mais de 1 s (clique ou tecla pulam), depois a tela inicial. Aparece na barra de tarefas; sem ícone na bandeja. |
| 2 | Fechar a janela (X) | O app encerra; no Gerenciador de Tarefas não sobra processo dele. |
| 3 | Tela inicial | 3 CDs (NFSU2, Most Wanted, Carbon), cada um com seu fundo. Sem endereço, sem "site", sem nome de navegador. Rodapé só com a versão. Indicador de WebGPU só se houver problema. |
| 4 | Tela inicial: passar o mouse, clicar num CD, START | Sons curtos. Durante o jogo, nenhum som do app. |
| 5 | START em cada jogo | "Carregando o jogo…" com o CD girando até o jogo aparecer; título da janela com o nome do jogo. |
| 6 | START do NFSU2 com o app em português | O jogo pergunta "Join crew?" (U2BR). Join entra; Not now não entra. Em inglês, nenhum convite. Recarregar não repete o convite. |
| 7 | App instalado: Ctrl+Shift+I, Ctrl+Shift+J, clique direito | Nada de painel de inspeção ou menu de navegador; F12 tira a foto do jogo. |
| 8 | Jogar | Alt, Espaço, Ctrl, Shift, WASD, Tab, Esc, F5, F8 e F12 vão para o jogo. Ctrl+W não fecha nada. |
| 9 | Em janela | Barra própria de 32 px: arrastar, dois cliques, encaixe, bordas, minimizar, maximizar e fechar funcionam; o jogo fica logo abaixo; reabrir mantém o tamanho. |
| 10 | Alt+Espaço com o jogo na tela (janela e tela cheia) | O menu do Windows não abre; nitro e freio de mão funcionam juntos. Nas telas do app, o menu abre. |
| 11 | Ctrl+F e Alt+Enter | Entram e saem da tela cheia, uma vez só, sem barulho do Windows. Enter sozinho vai para o jogo. |
| 12 | Tela cheia protegida: Alt+F4, F11, Win+D | Não fecha; a janela volta se for minimizada; aparece o atalho de saída. |
| 13 | Ctrl+Alt+Shift+P / abrir o app de novo | Sai do modo protegido. |
| 14 | Tela cheia: mouse no meio do topo / longe dele | Os botões aparecem só ali; longe, nada fica sobre o jogo. Tecla Windows ou Alt+Tab: pisca "Para sair da tela cheia: Ctrl+F" por ~6 s. |
| 15 | Botão de casinha (início) com partida aberta | Pergunta antes; volta aos CDs e fecha o jogo. |
| 16 | Recarregar (meio do topo ou Configurações) | Lembra de salvar na garagem. Cancelar ou Enter: nada muda. Confirmar: volta com save e configurações, sem segunda pergunta. Não existe atalho de teclado. |
| 17 | Fechar e abrir o app logo em seguida, várias vezes (também com o PC ocupado) | Pode demorar uns segundos; save e configurações continuam iguais. |
| 18 | Fechar e abrir logado | Continua logado, com saves; o jogo pega a versão nova. |
| 19 | Desligar o Wi-Fi e religar | Erro em frase simples; volta sozinho em ~5 s. |
| 20 | Erro de conexão com Wi-Fi funcionando | Botão "Tentar com DNS seguro": Cloudflare, depois Google, depois o padrão com pedido para conferir a rede. O que abrir fica ligado nas próximas vezes. |
| 21 | NFSU2 com save, abrir o app | "Meus saves" na tela inicial abre a pasta com o zip (2 últimas versões). Só com o NFSU2 escolhido. Nada é restaurado sozinho. |
| 22 | Disco com menos de 3 GB livres | Aviso na tela inicial. |
| 23 | Configurações | Idioma, Desempenho, atalhos e Personalização; o resto em "Avançado". Sem Qualidade, VSync, modo leve, mapa nem doação. |
| 24 | Trocar Português/English | Tela inicial, configurações, avisos e guias mudam. |
| 25 | Avançado > Desenhar a tela do jeito novo (Graphite + Delegated), desmarcar e reabrir | O app abre normalmente (erro da 2.0.4). Ligado por padrão. |
| 26 | Avançado > Preparar o jogo ao carregar / Aliviar o processador / Anti-serrilhado (FXAA) | Pedem para reabrir; comparar no F8 com a opção ligada e desligada. Sem travamento nem erro de gráficos. |
| 27 | Botão de filtro na barra e no topo da tela cheia | Cada clique troca o modo (Suave, Vívido, Intenso, Nítido, Vívido e nítido) e por fim desliga; o nome do modo aparece ao lado. Vale nos 3 jogos. |
| 28 | PC sem DirectX 12 (ou lista de bloqueio simulada: `--enable-features=WebGPUService:AdapterBlockList/%2A`) | Na tela inicial, o app liga o modo DirectX 11 e reabre sozinho, uma vez. Funcionando: aviso com "Desfazer e reabrir". Falhando: desliga e mostra o erro com tentar de novo. |
| 29 | Placa de nível 11_0 (ex.: GTX 550 Ti) | No modo DirectX 11, o jogo abre e roda. Comparar o FPS no F8. |
| 30 | Ctrl+Alt+I / lâmpada no topo | Abre as Dicas (só NFSU2); Esc ou Ctrl+Alt+I voltam ao jogo. |
| 31 | Dicas > abrir um passo a passo | Janela flutuante dentro da área do jogo; Feito/Anterior/Ver tudo; as teclas continuam indo para o jogo; 75% de opacidade; a altura segue o texto. |
| 32 | Guia: recolher, fechar, trocar de guia | Recolhido, a faixa pisca na borda do jogo e o mouse reabre. Trocar de guia recomeça do passo 1; o mesmo guia continua de onde parou. |
| 33 | Em janela: mover e diminuir com o guia aberto | O guia acompanha e continua dentro do jogo. |
| 34 | Dicas > Outros carros | Aviso "não oficial e não testado" e fonte em cada carro; funciona em EN. |
| 35 | Glitches com o Toyota Corolla | Aviso no início para ir direto às 3 barras. |
| 36 | Discord aberto, jogar cada jogo | "Jogando NFS Launcher", o nome curto do jogo embaixo, o tempo e o botão "Baixar o NFS Launcher" (conferir pelo perfil visto por outra pessoa). Ao voltar ao início, some. |
| 37 | Versão nova na pasta do Drive | Botão Baixar na tela inicial, sem como esconder; abre a pasta no navegador. Um APK mais novo sozinho não mostra nada. |
| 38 | Configurações > Personalização: trocar fundo e capa | PNG ou JPG; aparece na tela inicial e no carregamento; "Padrão" volta. |
| 39 | Limpar cache | Limpa sem perder saves. Não existe botão de apagar dados do jogo. |
| 40 | Salvar relatório de diagnóstico | Pede onde salvar; o .txt tem monitores, GPU, driver e "Pontos de atenção" (RivaTuner e Lossless Scaling, se abertos). |
| 41 | Rádio do jogo > escolher pasta de músicas | A janela de pasta abre e as músicas aparecem. |
| 42 | Minimizar com o jogo rodando | Com `background = pause`, o jogo pausa e continua ao voltar. |
| 43 | Gerenciador de Tarefas > Detalhes | GPU "Acima do normal" (o Chromium faz). Com Prioridade ligada, o jogo também; desligando, volta a Normal. |
| 44 | Mesmo trecho no Chrome e no app, F8 detalhado | Tempo de quadro e FPS iguais ou melhores; sem quadros misturados. |
| 45 | Instalar por cima da versão anterior | Sem admin, imagem própria na lateral; login e saves continuam. Desinstala limpo. |
| 46 | App instalado, `settings.ini` sem `NFSU2_MAP_TEXTURES`, HUD melhorado ligado (`ui_textures = uhud`) | Texturas do pacote (asfalto, pátio de pedra, árvores, céu) e o mapa detalhado aparecem; o log do F9 mostra `TEXPACKS/detailed.pak: 350 textures`. Saves continuam. |
| 45c | Jogo com `ui_textures = original` (ou sem a linha), Texturas HD ligada, abrir o app | O `settings.ini` passa a ter `ui_textures = map` e as texturas entram; cópia em `%APPDATA%\NFS Launcher Saves\settings.ini-antes-das-texturas-HD.txt`; o registro dos mods diz "gravada". Com `uhud`, nada muda. Desligar Texturas HD e reabrir: a linha volta a `original`, e o HUD HD de quem usa `uhud` continua. |
| 46a | Com o NFSU2 aberto, clicar em "Texturas HD" na barra (em janela) ou no ícone ao lado de Dicas (tela cheia), e também marcar e desmarcar em Configurações > Texturas | Ícone colorido quando ligado; aparece a pergunta "Reinicie o jogo para valer" com Depois e Reiniciar o jogo; Reiniciar recarrega e as texturas mudam. Com Most Wanted ou Carbon, o botão não aparece. |
| 46b | Pasta `%APPDATA%\NFS Launcher Mods\NFSU2` com um arquivo do mesmo caminho | Vale o da pasta do jogador; com o app aberto, trocar o arquivo só vale ao reabrir. |

## Celular (Android)

| # | Teste | Esperado |
|---|---|---|
| A1 | Instalar por cima da versão anterior | Login e saves continuam (mesma chave). |
| A2 | Abrir o app | Logo por pouco mais de 1 s com som, depois a tela inicial com os 3 CDs e o fundo do jogo marcado. Sem endereço. |
| A3 | START em cada jogo | CD girando até o jogo aparecer, sem tela preta; sem som do app durante o jogo. No NFSU2 em português, "Join crew?". |
| A4 | Fechar e abrir logado | Continua logado, com saves; o jogo pega a versão nova. |
| A5 | Abrir sem internet | Frase simples; ao voltar a internet, abre sozinho em até ~5 s. |
| A6 | Erro de conexão com rede ruim | Botão de DNS seguro, como no PC. |
| A7 | NFSU2 com save | Zip do save em Download/NFS Launcher (2 últimas versões); botão "Meus saves". |
| A8 | Pasta do Drive com APK mais novo | Botão Baixar, sem como esconder. Um .exe mais novo sozinho não mostra nada. |
| A9 | Configurações > Trocar fundo e capa | Aparece na tela inicial e no carregamento; "Padrão" volta. |
| A10 | Bolha: arrastar; guia: arrastar e A+ | Nada sai da tela. |
| A11 | Bolha: Reiniciar e Voltar ao início | Pedem um segundo toque; Reiniciar abre o mesmo jogo. |
| A12 | Dicas > Outros carros, com um guia aberto | O guia aberto troca para o novo. |
| A13 | Samsung A56 (Xclipse) | Sem GPU-ADAPTER-ANDROID; o jogo abre e roda. |
| A14 | Avançado > Preparar o jogo ao carregar | Vale na próxima abertura; comparar ligado e desligado. |
