# NFS Launcher — Windows 10/11 e Android

App que abre **só** os jogos do catálogo (`src/main/config.js`), numa janela própria com cara de jogo instalado:
- **NFSU2** em <https://nfsu2.xyz> (com dicas e guias);
- **Most Wanted** em <https://web.nfsmwo.com>;
- **Carbon** em <https://nfscrb.xyz>.

No PC é Electron 45.1.0 / Chromium 156, com motor próprio. No Android é Chromium 156 compilado, em `android-motor/`.

Os sites carregam pela internet, sem cópia nem alteração, e nenhum script é injetado (a única exceção são os mods de textura do NFSU2, abaixo). Cada jogo só navega no próprio site.

Download, novidades e SHA-256 de cada versão: <https://claude.ai/artifact/RKw9JHnui62my5XSLXEZGB>.

## Comandos (PC)

Rode um comando por vez:

```powershell
npm install        # também baixa o Electron
npm start          # abre o app com o motor oficial do Electron
npm test           # 136 testes
npm run verify     # 27 verificações estáticas (travam erros já corrigidos)
npm run pack       # monta dist\win-unpacked para examinar, sem instalador
npm run dist       # instalador dist\NFS-Launcher-Setup-<versão>.exe, com o motor próprio de C:\e\motor-final
```

Se o download do Electron travar:
```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
node node_modules\electron\install.js
```

- **Conferir uma montagem sem tocar nos dados:** `"NFS Launcher.exe" --conferir` sai com o código 73.
- **Assinatura:** o instalador não é assinado. O SmartScreen avisa; é só clicar em Mais informações > Executar assim mesmo.

## O que o app faz

- **Janela:**
  - Abre na barra de tarefas, sem ícone na bandeja. Nada roda em segundo plano nem inicia com o Windows.
  - Fechar a janela encerra tudo. Instância única.
  - Em janela, tem uma barra própria de 32 px. Na tela cheia, os botões só aparecem com o mouse no meio do topo.
- **Teclas do jogo:**
  - F5, as teclas de função, Ctrl+W e Alt+Espaço vão para o jogo.
  - Atalhos do app: `Ctrl+F` ou `Alt+Enter` (tela cheia), `Ctrl+Alt+O` (configurações), `Ctrl+Alt+I` (dicas), `Ctrl+Alt+Shift+P` (sair do modo protegido).
- **Modo protegido** (tela cheia pedida pelo app):
  - Bloqueia Alt+F4, F11 e minimizar.
  - Desligar o Windows nunca é bloqueado.
- **Gráficos iguais ao Chrome:** nenhuma flag que mude a composição dos quadros.
  - Avançado tem:
    - Graphite + Delegated, ligados por padrão;
    - "Preparar o jogo ao carregar";
    - "Aliviar o processador";
    - FXAA do motor próprio;
    - filtro de imagem com 5 modos.
  - Placa sem DirectX 12: liga sozinho o modo DirectX 11, inclusive no nível 11_0, com "Desfazer e reabrir". Nesse modo o jogo começa "cru": sem texturas HD, filtro de imagem, anti-serrilhado, "Preparar o jogo" e "Aliviar o processador" (dá para religar).
- **Saves:**
  - Nada apaga a pasta de dados nem os saves.
  - `profileLock.js` evita a perda ao fechar e abrir rápido.
  - O NFSU2 ganha uma cópia ao abrir (2 últimas versões) em `%APPDATA%\NFS Launcher Saves`.
  - A cópia nunca volta sozinha: restaurar é pelo "Restaurar" do jogo.
- **Conexão:**
  - O jogo abre com carga normal, como no Chrome (sem recarga sem cache), mantendo login e saves.
  - A tela de erro tem um botão de DNS seguro (Cloudflare, depois Google).
- **Convite da equipe:** o START do NFSU2, com o app em português, abre `#crew=U2BR`. O site pergunta antes de entrar.
- **Atualizações:**
  - O app lê só a lista de nomes da pasta pública do Drive.
  - Com `NFS-Launcher-Setup-<versão>.exe` mais novo, o botão Baixar fica na tela inicial e abre a pasta no navegador.
- **Discord:** "Jogando NFS Launcher", só pelo canal local do PC.
- **Mods de textura (NFSU2, PC, `modFiles.js`; Android abaixo):**
  - O pacote do app (abaixo) e a pasta do jogador, com a mesma árvore do jogo (`%APPDATA%\NFS Launcher Mods\NFSU2`), que vale por cima. Os arquivos delas entram na lista de arquivos que o jogo recebe do site e são entregues pelo app.
  - O instalador traz, em `resources\texturas`, um pacote de cada mod da comunidade (`redux.pak`, `definitive.pak`, `nextgen.pak`) e o mapa detalhado do site (`site.pak`), montados fora do repositório (os arquivos dos mods não entram aqui). Uma página do instalador (`build/installer.nsh`) tem uma caixa por mod: os desmarcados são apagados depois de copiar, e a escolha fica em `HKCU\Software\NFS Launcher` para a próxima instalação. Sem nenhum mod, o app desfaz a linha `ui_textures` que tinha gravado.
  - **Partes (`texPack.js`):** na janela "Texturas HD", cada parte (asfalto, calçadas, prédios, árvores, céu, carros, efeitos, menus) vem do mod escolhido, ou "Original"; os outros mods completam o que faltar naquela parte. O app não grava pacote novo: monta `TEXPACKS\detailed.pak` virtual (cabeçalho em memória e trechos dos pacotes de origem, lidos quando o jogo pede), com uma data própria para cada escolha (o jogo guarda cópia por tamanho e data). Mesma textura no site e num mod: fica a maior (empate: a do site). O jogo já carrega esse pacote com o HUD melhorado, sem mudar o `settings.ini`.
  - Desde a 3.0.0, o pacote também tem as texturas de rua, calçada e pista guardadas com paleta de cores (o jogo as envia em 32 bits) e as que ficam em blocos comprimidos (HUFF e JDLZ) dos carros e do céu. As que o HUD melhorado do site também troca ficam fora: com ele ligado, vale sempre o do site.
  - Com mods e o NFSU2 aberto, os pedidos do site passam pelo app: a lista e os arquivos dos mods são respondidos por ele, o resto segue para o site sem mudança. Sem script na página. Vale ao abrir o app.
  - O jogo só carrega o pacote com `ui_textures` em `map` ou `uhud` no `settings.ini` dele. Com Texturas HD ligada, o app troca só essa linha para `ui_textures = map` (mapa detalhado; menus e HUD continuam), ao abrir e antes de o navegador abrir os dados (`gameSettings.js`). Só mexe se estiver em `original` ou ausente, nunca com `NFSU2_MAP_TEXTURES` escrito pelo jogador, guarda cópia em `%APPDATA%\NFS Launcher Saves` e, com a opção desligada, desfaz só o que ele trocou. É a única escrita do app nos dados do jogo.
  - O botão "Texturas HD" da barra (na tela cheia, só o ícone, ao lado de Dicas) e "Escolher as partes…" em Configurações > Texturas abrem a janela "Texturas HD", no estilo das Dicas: liga e desliga as texturas e escolhe o mod de cada parte, tudo de uma vez; nada muda até "Aplicar" (Voltar ou Esc descartam). O botão só aparece com o NFSU2 aberto e o pacote presente. A troca vale quando o jogo carrega de novo: ao aplicar, o app pergunta uma vez só se reinicia o jogo agora, lembrando de salvar na garagem.
- **Texturas HD no Android (1.6.4):**
  - Um pacote só, `assets/nfs/texturas.ntxp` no APK, sem compressão: Redux e NextGen com o mapa detalhado do site, cada textura com no máximo 2x o lado da original (as menores ficam como vieram).
  - O motor (patch `0007`, código em `android-motor/nfs_texturas.cc`) responde, só para o site do NFSU2, a lista de arquivos (com o pacote acrescentado) e os pedidos dele; o resto segue para o site sem mudança.
  - Antes de abrir o jogo, `GameSettings.java` faz o mesmo que o `gameSettings.js` do PC (`ui_textures = map`). A opção Configurações > Texturas HD desligada passa `--nfs-sem-texturas` ao motor e desfaz a linha.

## Dicas para o jogador

- **Driver de vídeo atualizado:** é o que mais pesa no WebGPU.
- **Placas abaixo do DirectX 11 nível 11_0** (só DirectX 10) não rodam o jogo.
- **Para o app, deixe desligados:**
  - geração de quadros (NVIDIA Smooth Motion, AMD AFMF, Lossless Scaling);
  - overlays como RivaTuner.
  - O relatório de diagnóstico avisa quando Lossless Scaling ou RivaTuner estão abertos.
- **Monitor de 144/165 Hz:** com `fps = auto` o jogo roda a 120 fps. Use G-SYNC/FreeSync ou o monitor a 120 Hz.
- **Qualidade:** é decidida no próprio jogo (Settings), e o `settings.ini` fica no perfil do app, separado do Chrome. `F8` mostra o FPS.
- **Engasgo:** em Configurações > Avançado, salve o relatório de diagnóstico. Compare com o Chrome no mesmo trecho, com `F9` > Download log.
- **Save do navegador:** "Baixar backup" no navegador e "Restaurar" no app.

## Estrutura

```
src/main/      main.js e a lógica pura coberta por testes (config, settings, profileLock, saveCopy, gpuFallback, imageFilter, discord…)
src/renderer/  ui.html/css/js, i18n.js (inglês), tips.js (dicas), guide.* e panel.* (guia flutuante), bg/ e games/ (fundos e CDs)
build/         ícones, installer.nsh e imagens do instalador
scripts/       verify.js, export-guides.js, make-discs.ps1, make-icons.ps1, make-installer-art.ps1
pc-motor/      compilação do motor próprio do PC (código em C:\e)
android-motor/ compilação do app Android (WSL NFSMotor; a chave de assinatura não vai para o repositório)
test/          testes (node:test)
docs/          TESTES.md, post-divulgacao.md, relatos
```

Checklist de testes manuais: [`docs/TESTES.md`](docs/TESTES.md).

## Licença

O código está sob a licença MIT ([`LICENSE`](LICENSE)). Need for Speed e a arte dos jogos (capas e CDs) pertencem aos seus donos e não entram na licença. Este app não é oficial e não tem ligação com a EA nem com os autores dos sites.
