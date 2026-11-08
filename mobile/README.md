# NFS Motor

O NFS Motor é o navegador próprio do NFS Launcher de celular. Por dentro é o Chromium, o motor do Chrome, compilado por nós.

**Por que ele existe:** o navegador embutido dos apps de Android (WebView) não deixa a página ficar "isolada", e o jogo
exige isso (o erro PAGE-NOT-ISOLATED). O Chromium completo deixa. Com o Motor instalado, o NFS Launcher abre o jogo
como "Trusted Web Activity", sem barra nenhuma e em tela cheia. Sem o Motor, o launcher usa o Chrome do celular.

**Atualizar:** o Motor fica "congelado" numa versão do Chromium e roda bem desatualizado. Ele só abre os jogos do
catálogo, e só a pedido do nosso launcher. Só vale recompilar quando:
- o jogo passar a exigir algo novo do Chrome;
- sair uma falha de segurança grave.

Jogo novo no catálogo **não** exige recompilar o Motor: basta atualizar o launcher.

## Como montar (no PC do Bruno)
1. Linux do Windows (WSL2 + Ubuntu 24.04), já instalado pelo app.
2. No Ubuntu: `bash /mnt/c/Users/bruno/Desktop/nfsu2-launcher/mobile/build.sh`
   - a primeira vez baixa ~40–60 GB e compila por 6–10 h;
   - o resultado sai em `dist/NFS-Motor-<versão>-arm64.apk`, assinado com a mesma chave do launcher
     (`android/nfs-launcher.jks`; NUNCA apagar).
3. Outra versão do Chromium: `CHROMIUM_TAG=156.0.xxxx.yy bash build.sh`.

## Arquivos
- `args.gn`: configuração da compilação (arm64, versão de lançamento, pacote `xyz.nfs.motor`).
- `patches/*.patch`: mudanças no código do Chromium (aplicadas em ordem pelo `build.sh`):
  - confiar no NFS Launcher para abrir sem barra;
  - nome e ícone;
  - sem telas de primeira execução;
  - não aparecer como navegador para outros links.
