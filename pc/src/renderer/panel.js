(() => {
  'use strict';
  // Comum às janelas flutuantes: botões de sistema (recolher/fechar), transparência e a alça de redimensionar.
  // A alça usa captura do ponteiro: continua funcionando com o mouse fora da janela durante o arrasto.
  const $ = (id) => document.getElementById(id);
  const startOpacity = Number(new URLSearchParams(location.search).get('op'));
  const op = $('p-op');
  const showPct = () => { if ($('p-op-v')) $('p-op-v').textContent = `${Math.round(Number(op.value) * 100)}%`; };
  if (op && Number.isFinite(startOpacity) && startOpacity > 0) op.value = String(startOpacity);
  if (op) { showPct(); op.oninput = (e) => { showPct(); window.panel.setOpacity(e.target.value); }; }
  $('p-dock').onclick = () => window.panel.dock();
  $('p-close').onclick = () => window.panel.close();

  const grip = $('p-grip');
  if (grip) {
    const widthOnly = grip.classList.contains('wide');
    let start = null;
    grip.addEventListener('pointerdown', (e) => {
      start = { x: e.screenX, y: e.screenY, w: window.innerWidth, h: window.innerHeight };
      grip.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    grip.addEventListener('pointermove', (e) => {
      if (!start) return;
      const w = start.w + (e.screenX - start.x);
      const h = widthOnly ? NaN : start.h + (e.screenY - start.y);
      window.panel.setSize(w, h);
    });
    const end = () => { start = null; };
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
  }
})();
