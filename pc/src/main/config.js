'use strict';
// Configuração fixa do app (não é preferência do usuário).
// Catálogo de jogos: cada um abre o próprio site. As dicas/guias e a seção de qualidade (settings.ini)
// são só do NFSU2 (`tips`). Para acrescentar um jogo: id + site + hosts + imagem do CD em src/renderer/games/.
// App "NFS Launcher" no Discord Developer Portal (só o Application ID, que é público). Vazio = não aparece no Discord.
const DISCORD_APP = '1566579761193426986';
const GAMES = Object.freeze({
  nfsu2: Object.freeze({
    id: 'nfsu2', short: 'NFSU2', name: 'Need for Speed: Underground 2',
    // startUrl: só o START usa (convite da equipe; o site tira o "#" e pergunta se quer entrar). Recarregar usa `url`:
    // com a página aberta, o mesmo endereço com "#" só muda o "#", não recarrega nada e deixaria o "Carregando" preso.
    url: 'https://nfsu2.xyz', startUrl: 'https://nfsu2.xyz/#crew=U2BR', hosts: ['nfsu2.xyz', 'www.nfsu2.xyz'], disc: 'games/nfsu2.png', tips: true,
    discordId: DISCORD_APP,
  }),
  nfsmw: Object.freeze({
    id: 'nfsmw', short: 'NFSMW', name: 'Need for Speed: Most Wanted',
    // ".nfsmwo.com" = qualquer subdomínio (o cadastro/login pode passar por outro endereço do mesmo site e voltar).
    url: 'https://web.nfsmwo.com', hosts: ['nfsmwo.com', '.nfsmwo.com'], disc: 'games/nfsmw.png', tips: false,
    discordId: DISCORD_APP,
  }),
  // Carbon (pedido do Bruno, 05/11): canvas #canvas, como o Most Wanted. Sem convite de equipe: o site não tem `#crew=`.
  nfsc: Object.freeze({
    id: 'nfsc', short: 'NFSC', name: 'Need for Speed: Carbon',
    url: 'https://nfscrb.xyz', hosts: ['nfscrb.xyz', '.nfscrb.xyz'], disc: 'games/nfsc.png', tips: false,
    discordId: DISCORD_APP,
  }),
});
const GAME_IDS = Object.keys(GAMES);
const DEFAULT_GAME = 'nfsu2';

// Hosts para os quais a NAVEGAÇÃO é permitida (de todos os jogos, ou só do jogo aberto).
// Recursos carregados pela página (imagens, scripts, WebSockets, saves na nuvem) não passam por esta lista.
const ALLOWED_HOSTS = new Set(GAME_IDS.flatMap((id) => GAMES[id].hosts));

// Um host da lista vale exatamente; um que começa com "." vale para qualquer subdomínio dele.
const hostMatches = (host, list) => [...list].some((h) => (h.startsWith('.') ? host.endsWith(h) && host.length > h.length : host === h));
function isAllowedUrl(u, gameId) {
  try {
    const x = new URL(u);
    const hosts = gameId && GAMES[gameId] ? GAMES[gameId].hosts : ALLOWED_HOSTS;
    return x.protocol === 'https:' && !x.username && !x.password && hostMatches(x.hostname, hosts);
  } catch {
    return false;
  }
}
const gameOf = (id) => GAMES[id] || GAMES[DEFAULT_GAME];
// Endereço do START: em inglês, o normal, sem o convite da equipe brasileira (pedido do Bruno).
const startUrlOf = (id, lang) => { const g = gameOf(id); return lang === 'en' ? g.url : g.startUrl || g.url; };

// DNS seguro, na ordem em que é tentado. Pelo IP: funciona mesmo quando o DNS da rede não resolve nome nenhum.
const SECURE_DNS = Object.freeze({
  cloudflare: Object.freeze(['https://1.1.1.1/dns-query', 'https://1.0.0.1/dns-query']),
  google: Object.freeze(['https://8.8.8.8/dns-query', 'https://8.8.4.4/dns-query']),
});

// A partição continua com o nome antigo para não perder os saves do NFSU2; cada site guarda os próprios dados.
module.exports = { SECURE_DNS, GAMES, GAME_IDS, DEFAULT_GAME, ALLOWED_HOSTS, isAllowedUrl, gameOf, startUrlOf, PARTITION: 'persist:nfsu2' };
