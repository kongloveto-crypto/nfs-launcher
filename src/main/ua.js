'use strict';
// Transforma o User-Agent do Electron no User-Agent do Chrome equivalente.
// "…(KHTML, like Gecko) NFSU2 Launcher/1.0.0 Chrome/152.0.0.0 Electron/44.7.0 Safari/537.36"
//   → "…(KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36"
// Assim o site trata o app exatamente como o Chrome (mesma detecção de versão e padrões).
function toChromeUA(ua) {
  if (typeof ua !== 'string') return ua;
  return ua
    .replace(/\)\s[^()]*?\sChrome\//, ') Chrome/')   // nome/versão do app antes de "Chrome/"
    .replace(/\sElectron\/\S+/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
module.exports = { toChromeUA };
