'use strict';
// Classifica a falha ao abrir o jogo: a tela de erro mostra uma frase simples, nunca o código técnico.
const OFFLINE = new Set([-21, -105, -106, -109, -137]); // rede mudou, nome não resolvido, sem internet, sem rota, DNS

function errorKind(code) {
  if (code === -1) return 'crash';     // o jogo caiu várias vezes seguidas
  if (code >= 500) return 'server';    // o site respondeu com erro
  return OFFLINE.has(code) ? 'offline' : 'other';
}

// Botão "Tentar com DNS seguro": só quando o jogo não abre por conexão, nunca com o site fora do ar nem com o jogo caído.
function offersSecureDns(kind) { return kind === 'offline' || kind === 'other'; }

module.exports = { errorKind, offersSecureDns };
