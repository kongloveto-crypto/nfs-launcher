'use strict';
// Relatório de diagnóstico — lógica PURA (sem Electron), coberta por testes.
// O main coleta os dados; aqui só se monta o texto e os "pontos de atenção".
// O arquivo é salvo onde o usuário escolher e nunca é enviado a lugar nenhum (sem telemetria).
// Não inclui nome de usuário, nome do PC nem caminhos de pastas.

const VENDORS = { 0x10de: 'NVIDIA', 0x1002: 'AMD', 0x8086: 'Intel', 0x1414: 'Microsoft (adaptador básico)' };
const vendorName = (id) => VENDORS[id] || `0x${(id || 0).toString(16)}`;
// Onde cada fabricante distribui o driver (o app não abre links: só o nome do programa).
const DRIVER_APP = {
  0x10de: 'NVIDIA App (ou nvidia.com/drivers)',
  0x1002: 'AMD Software: Adrenalin Edition (ou amd.com/support)',
  0x8086: 'Intel Driver & Support Assistant (ou intel.com/drivers)',
};
const driverHint = (id) => DRIVER_APP[id] || 'o site do fabricante da placa de vídeo';

// Programas que se injetam na apresentação dos quadros ou geram quadros extras: causam engasgos e
// "quadros misturados" mesmo quando o jogo está bem. Só esta lista é procurada (nada mais da lista de processos sai no relatório).
const KNOWN_TOOLS = {
  'rtss.exe': 'RivaTuner Statistics Server (overlay/limitador do MSI Afterburner): desative-o para o NFS Launcher ou feche-o',
  'losslessscaling.exe': 'Lossless Scaling: a geração de quadros mistura quadros; não use com o app',
  'fraps.exe': 'Fraps: overlay antigo que atrapalha jogos em WebGPU; feche-o',
  'obs64.exe': 'OBS aberto: captura de jogo/janela custa desempenho; prefira "Captura de tela" ou feche ao testar',
};
function detectTools(processNames) {
  const running = new Set((processNames || []).map((n) => String(n).toLowerCase()));
  return Object.keys(KNOWN_TOOLS).filter((exe) => running.has(exe));
}

// Problemas conhecidos que causam engasgo ou quadros misturados, detectáveis pelo app.
function findIssues(d) {
  const out = [];
  const shown = (d.displays || []).find((x) => x.current) || (d.displays || [])[0];
  if (d.flags && d.flags.uncapped) {
    out.push('Sem VSync (--uncapped): menos atraso, mas pode causar tearing (quadros "rasgados"/misturados) e ritmo irregular. Se aparecer, abra o app sem o --uncapped.');
  }
  if (shown && (d.displays || []).some((x) => x.hz && shown.hz && x.hz !== shown.hz)) {
    out.push(`Monitores com taxas diferentes (${d.displays.map((x) => `${x.hz} Hz`).join(' + ')}). Se engasgar, teste com o outro monitor desligado ou na mesma taxa.`);
  }
  if (shown && shown.hz > 120 && shown.hz < 240) {
    out.push(`Monitor a ${shown.hz} Hz: com fps = auto o jogo roda a 120 fps, que não acompanha ${shown.hz} Hz; sem G-SYNC/FreeSync isso engasga (também no Chrome). Ative o G-SYNC/FreeSync ou use o monitor a 120 Hz.`);
  }
  const devices = d.gpuDevices || [];
  const active = devices.find((g) => g.active);
  if (active && active.vendorId !== 0x10de && active.vendorId !== 0x1002 && devices.some((g) => g.vendorId === 0x10de || g.vendorId === 0x1002)) {
    out.push(`A GPU ativa é ${vendorName(active.vendorId)}, mas o PC tem uma placa dedicada. Em Configurações do Windows > Vídeo > Elementos gráficos, marque o NFS Launcher como "Alto desempenho".`);
  }
  if (active && active.vendorId === 0x1414) {
    out.push('O Windows está usando o "Microsoft Basic Render Driver": a placa de vídeo está sem driver. Instale o driver do fabricante.');
  }
  if (d.gpuFeatures && d.gpuFeatures.webgpu && !/^enabled/.test(d.gpuFeatures.webgpu)) {
    out.push(`WebGPU não está ativo (${d.gpuFeatures.webgpu}). Atualize o driver pelo ${driverHint(active && active.vendorId)}. Placa sem DirectX 12 roda no modo DirectX 11 (nível 11_0 ou mais); placas só com DirectX 10 não rodam o jogo.`);
  }
  if (d.onBattery) {
    out.push('Notebook na bateria: o Windows e a placa de vídeo reduzem o desempenho. Ligue na tomada e use o modo de energia "Melhor desempenho".');
  }
  if (d.ramGB && d.ramGB < 8) {
    out.push(`Só ${d.ramGB} GB de memória: o jogo reserva até 4 GB. Feche outros programas (principalmente navegadores) antes de jogar.`);
  }
  for (const exe of d.tools || []) if (KNOWN_TOOLS[exe]) out.push(KNOWN_TOOLS[exe]);
  if (d.settings && d.settings.highPriority) {
    out.push('Prioridade "acima do normal" ligada: o processo do jogo fica acima do normal, o que o Chrome não faz (a GPU o próprio Chromium já sobe). Se engasgar, teste com ela desligada.');
  }
  if (d.flags && d.flags.noUi) out.push('Modo de teste (só o jogo) ativo.');
  if (d.window && d.window.jogoIniciado === false) {
    out.push('O jogo não estava aberto quando o relatório foi gerado: gere de novo com o jogo rodando, logo depois de um engasgo.');
  }
  return out;
}

function line(k, v) { return `${k.padEnd(22)} ${v === undefined || v === null || v === '' ? 'n/d' : v}`; }

const NOISY = new Set(['glExtensions', 'glWsExtensions']); // listas enormes, sem utilidade para comparar
function scalarEntries(obj, max = 60) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj)
    .filter(([k, v]) => !NOISY.has(k) && ['string', 'number', 'boolean'].includes(typeof v))
    .slice(0, max)
    .map(([k, v]) => line(k, String(v).slice(0, 200)));
}

function formatReport(d) {
  const L = [];
  L.push('NFS Launcher — relatório de diagnóstico');
  L.push(`Gerado em ${d.when}. Este arquivo fica só no seu PC; envie a quem for ajudar, se quiser.`);
  L.push('');
  L.push('== Pontos de atenção ==');
  const issues = findIssues(d);
  L.push(...(issues.length ? issues.map((x) => `* ${x}`) : ['* Nada de errado detectado pelo app.']));
  L.push('');
  L.push('== Versões ==');
  L.push(line('App', d.app), line('Electron', d.electron), line('Chromium', d.chrome));
  L.push(line('Windows', d.os), line('CPU', d.cpu), line('Memória', d.ramGB ? `${d.ramGB} GB` : null));
  L.push(line('Energia', d.onBattery === undefined ? null : d.onBattery ? 'bateria' : 'tomada'));
  L.push('');
  L.push('== Opções do app ==');
  L.push(...Object.entries(d.settings || {}).map(([k, v]) => line(k, String(v))));
  L.push(line('Opções de abertura', Object.entries(d.flags || {}).filter(([, v]) => v).map(([k]) => k).join(', ') || 'nenhuma'));
  L.push('');
  L.push('== Janela ==');
  L.push(...Object.entries(d.window || {}).map(([k, v]) => line(k, String(v))));
  L.push('');
  L.push('== Monitores ==');
  for (const x of d.displays || []) {
    L.push(`${x.current ? '-> ' : '   '}${x.label || 'Monitor'}: ${x.pixels} a ${x.hz} Hz, escala ${x.scale}${x.primary ? ', principal' : ''}${x.current ? ' (janela do jogo)' : ''}`);
  }
  L.push('');
  L.push('== GPU ==');
  for (const g of d.gpuDevices || []) {
    L.push(`${g.active ? '-> ' : '   '}${vendorName(g.vendorId)} ${g.deviceString || ''} (0x${(g.deviceId || 0).toString(16)}) driver ${g.driverVersion || 'n/d'}${g.active ? ' (ativa)' : ''}`);
  }
  L.push(...Object.entries(d.gpuFeatures || {}).map(([k, v]) => line(k, v)));
  const aux = scalarEntries(d.gpuAux);
  if (aux.length) { L.push(''); L.push('-- Detalhes do Chromium (compare com chrome://gpu no Chrome) --'); L.push(...aux); }
  L.push('');
  L.push('== Processos do app (CPU medida durante 1 segundo) ==');
  for (const m of d.metrics || []) {
    L.push(`${String(m.type).padEnd(14)} CPU ${m.cpu.toFixed(1).padStart(5)}%  memória ${String(m.memMB).padStart(5)} MB  prioridade ${m.priority}`);
  }
  L.push('');
  return L.join('\r\n');
}

module.exports = { findIssues, formatReport, vendorName, driverHint, detectTools, KNOWN_TOOLS };
