'use strict';
// Filtro de imagem do jogo: só CSS no canvas (sem script e sem tocar no jogo). #game é o NFSU2, #canvas é o Most Wanted.
// Cor e contraste não custam quase nada. Nitidez custa ~0,23 ms por quadro em 1440p; com cor, ~0,5 ms.
const SHARPEN = 'url("data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\'><filter id=\'n\' color-interpolation-filters=\'sRGB\'><feConvolveMatrix order=\'3\' preserveAlpha=\'true\' kernelMatrix=\'0 -.25 0 -.25 2 -.25 0 -.25 0\'/></filter></svg>#n")';

const MODES = Object.freeze({
  suave: 'saturate(1.12) contrast(1.03)',
  vivido: 'saturate(1.25) contrast(1.05)',
  intenso: 'saturate(1.5) contrast(1.08)',
  nitido: SHARPEN,
  vividoNitido: `${SHARPEN} saturate(1.25) contrast(1.05)`,
});
const MODE_IDS = Object.freeze(Object.keys(MODES));

function css(on, mode) {
  if (!on || !Object.prototype.hasOwnProperty.call(MODES, mode)) return null;
  return `#game,#canvas{filter:${MODES[mode]}}`;
}

// Botão da barra: cada clique vai para o próximo modo e, depois do último, desliga. Desligado, volta ao primeiro.
function next(on, mode) {
  const i = MODE_IDS.indexOf(mode);
  if (!on || i < 0) return { on: true, mode: MODE_IDS[0] };
  if (i === MODE_IDS.length - 1) return { on: false, mode };
  return { on: true, mode: MODE_IDS[i + 1] };
}

module.exports = { MODE_IDS, css, next };
