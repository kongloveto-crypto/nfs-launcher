'use strict';
(function () {
// Conteúdo da tela "Dicas" e dos guias passo a passo (janela flutuante), em português e inglês.
// build(lang) devolve { TABS, GUIDES, GROUP_TITLES, UI } no idioma pedido ('pt' ou 'en').
// Cada aba é uma lista de blocos:
//   { h: 'título' } · { p: 'texto' } · { note: 'destaque' } · { ul: [...] } · { ol: [...] } · { kv: [[chave, valor], ...] }
//   · { guide: 'id' } (botão que abre o guia passo a passo)
// Um guia tem partes; cada parte tem `steps` (frases) ou `rows` ([item, ajuste]) e, opcionalmente, um aviso `note`.
// Para acrescentar uma dica nova: escreva o texto com L('português', 'english') (texto puro, nada vira HTML).
// Ids de guia: letra + número (t1, g1...) — o processo principal só aceita esse formato.
const LANGS = ['pt', 'en'];

function build(lang) {
  const en = lang === 'en';
  const L = (pt, eng) => (en ? eng : pt);

  // ── Tuning do Toyota Corolla AE86 ──
  const AE86_PARTS = [
    [L('Motor', 'Engine'), L('Instale tudo.', 'Install everything.')],
    ['ECU', L('Instale tudo.', 'Install everything.')],
    [L('Transmissão', 'Transmission'), L('NÃO instale o Diferencial (Differential), o Diferencial de deslizamento limitado (Limited Slip Differential) nem o Câmbio de 6 marchas (6 Speed Transmission). Instale o restante: Kit de engate curto (Short Throw Shift Kit), Volante leve (Lightweight Flywheel) e Embreagem de alto desempenho (High Performance Clutch).',
      'Do NOT install the Differential, the Limited Slip Differential or the 6 Speed Transmission. Install the rest: Short Throw Shift Kit, Lightweight Flywheel and High Performance Clutch.')],
    [L('Suspensão', 'Suspension'), L('Instale tudo, exceto as placas de camber ajustáveis: assim a relação de direção vai até 1,14 em vez de só 1,10.', 'Install everything except the adjustable camber plates: this lets the steering ratio go to 1.14 instead of only 1.10.')],
    [L('Nitro', 'Nitrous'), L('Estágio 3.', 'Stage 3.')],
    [L('Pneus', 'Tires'), L('Estágio 3.', 'Stage 3.')],
    [L('Freios', 'Brakes'), L('Instale tudo.', 'Install everything.')],
    [L('Redução de peso', 'Weight reduction'), L('Instale tudo.', 'Install everything.')],
    ['Turbo', L('Estágio 3.', 'Stage 3.')],
  ];
  const AE86_UNIQUE = [
    [L('Estágio 3', 'Stage 3'), L('Motor.', 'Engine.')],
    [L('Estágio 4', 'Stage 4'), L('Turbo (dá 2 kW a mais que a ECU).', 'Turbo (gives 2 kW more than the ECU).')],
    [L('Estágio 5', 'Stage 5'), L('Redução de peso para Street-X; Nitro para os demais modos.', 'Weight reduction for Street-X; Nitrous for the other modes.')],
  ];
  const AE86_POWER = [
    [L('Peças comuns', 'Regular parts'), L('328,7 kW. Se der 328,9 kW, volte ECU e turbo para o padrão e ajuste de novo.', '328.7 kW. If you get 328.9 kW, reset the ECU/turbo settings to default and tune again.')],
    [L('Peças exclusivas', 'Unique parts'), L('350,8 kW. Se der 351 kW ou mais, volte ECU e turbo para o padrão e ajuste de novo.', '350.8 kW. If you get 351 kW or more, reset the ECU/turbo settings to default and tune again.')],
  ];
  const AE86_POWER_NOTE = L('Dá para tirar mais potência ajustando só a ECU e deixando o turbo no padrão, mas o carro fica mais lento.',
    'You can get more power by tuning only the ECU and leaving the turbo at default, but the car will be slower.');
  const sharedSusp = [
    [L('Rebaixamento dianteiro', 'Front ride height'), L('Mínimo', 'Minimum')],
  ];
  const CIRCUIT = {
    susp: [
      ...sharedSusp,
      [L('Rebaixamento traseiro', 'Rear ride height'), L('Máximo (mínimo nos parques industriais)', 'Maximum (minimum in the industrial parks)')],
      [L('Molas dianteiras', 'Front springs'), L('Mínimas', 'Minimum')],
      [L('Molas traseiras', 'Rear springs'), L('Máximas (mínimas nos parques industriais)', 'Maximum (minimum in the industrial parks)')],
      [L('Amortecedores dianteiros', 'Front shocks'), L('Mínimos', 'Minimum')],
      [L('Amortecedores traseiros', 'Rear shocks'), L('Mínimos', 'Minimum')],
      [L('Barra estabilizadora dianteira', 'Front sway bar'), L('Mínima', 'Minimum')],
      [L('Barra estabilizadora traseira', 'Rear sway bar'), L('Mínima', 'Minimum')],
      [L('Relação de direção', 'Steering ratio'), L('1,14 (sem as placas de camber ajustáveis)', '1.14 (without the adjustable camber plates)')],
    ],
    rest: [
      [L('Transmissão', 'Transmission'), L('Não disponível no modo Carreira (qualquer porcentagem). Alguns IL Sprints pedem a 6ª marcha; as relações exatas não são conhecidas.', 'Not available in Career mode (any percentage). Some IL Sprints call for a 6th gear; the exact ratios are not known.')],
      [L('Aerodinâmica dianteira', 'Front aerodynamics'), L('Mais alta (precisa do para-choque estágio 3)', 'Highest (needs the stage 3 bumper)')],
      [L('Aerodinâmica traseira', 'Rear aerodynamics'), L('Mais alta (precisa do aerofólio estágio 3)', 'Highest (needs the stage 3 spoiler)')],
      [L('Pneus dianteiros', 'Front tires'), L('Mais alto', 'Highest')],
      [L('Pneus traseiros', 'Rear tires'), L('Mais alto', 'Highest')],
      [L('Distribuição de frenagem', 'Brake bias'), L('Mais para a frente; não é importante (0,21 é uma boa).', 'More to the front; not important (0.21 works well).')],
    ],
    tune: [
      ['ECU', L('Coloque a primeira barra no mínimo: as outras enchem no máximo e dá a maior potência.', 'Set the first bar to the lowest level: all other bars fill to the max and you get the most power.')],
      ['Turbo', L('Barras 5 a 9 no máximo.', 'Max out bars 5 to 9.')],
      [L('Nitro', 'Nitrous'), L('Duração de 6 segundos costuma ser a melhor; 5 segundos podem ser melhores em algumas pistas.', 'A 6-second duration is usually best; 5 seconds can be better on some tracks.')],
    ],
  };
  const DRAG = {
    susp: [
      ...sharedSusp,
      [L('Rebaixamento traseiro', 'Rear ride height'), L('Máximo', 'Maximum')],
      [L('Molas dianteiras', 'Front springs'), L('Mínimas', 'Minimum')],
      [L('Molas traseiras', 'Rear springs'), L('Máximas', 'Maximum')],
      [L('Amortecedores dianteiros', 'Front shocks'), L('Mínimos', 'Minimum')],
      [L('Amortecedores traseiros', 'Rear shocks'), L('Mínimos', 'Minimum')],
      [L('Barras estabilizadoras', 'Sway bars'), L('Não importam', "Don't matter")],
      [L('Relação de direção', 'Steering ratio'), L('Não importa', "Doesn't matter")],
    ],
    rest: [
      [L('Transmissão', 'Transmission'), 'N/D'],
      [L('Aerodinâmica dianteira', 'Front aerodynamics'), L('Mais baixa', 'Lowest')],
      [L('Aerodinâmica traseira', 'Rear aerodynamics'), L('Mais baixa', 'Lowest')],
      [L('Pneus dianteiros', 'Front tires'), L('Mais alto', 'Highest')],
      [L('Pneus traseiros', 'Rear tires'), L('Mais alto', 'Highest')],
      [L('Distribuição de frenagem', 'Brake bias'), L('Não é importante', 'Not important')],
    ],
    tune: [
      ['ECU', L('Primeira barra no mínimo (as outras enchem no máximo).', 'First bar to the lowest level (the others fill to the max).')],
      ['Turbo', L('Barras 5 a 9 no máximo.', 'Max out bars 5 to 9.')],
      [L('Nitro', 'Nitrous'), L('Duração de 4 segundos costuma ser a melhor.', 'A 4-second duration is usually best.')],
    ],
  };
  const partTitles = {
    susp: L('Suspensão', 'Suspension'),
    rest: L('Transmissão, aerodinâmica, pneus e freio', 'Transmission, aerodynamics, tires and brakes'),
    tune: L('ECU, turbo e nitro', 'ECU, turbo and nitrous'),
  };
  const setup = (d) => ['susp', 'rest', 'tune'].map((k) => ({ title: partTitles[k], rows: d[k] }));

  // ── Glitches do Dyno ──
  const TURBO_PREP = {
    title: L('Parte A — preparação do Turbo', 'Part A — turbo preparation'),
    steps: [
      L('Monte um carro novo.', 'Build a new car.'),
      L('Instale todas as peças de desempenho, exceto a ECU.', 'Install all performance parts except the ECU.'),
      L('Salve o jogo antes de entrar no dinamômetro.', 'Save the game before entering the dyno.'),
      L('No Turbo, coloque as barras 4 a 9 no máximo (a quantidade de barras pode variar conforme o carro).', 'In the Turbo tuning, max out bars 4 to 9 (the number of bars may vary by car).'),
      L('Rode o dinamômetro.', 'Run the dyno.'),
      L('Saia do dinamômetro e entre em Peças de Desempenho.', 'Leave the dyno and go to Performance Parts.'),
      L('Instale o Turbo de nível 1.', 'Install the level 1 Turbo.'),
      L('Entre no dinamômetro e baixe até o fim as duas últimas barras do Turbo.', 'Enter the dyno and fully lower the last two Turbo bars.'),
      L('Rode o dinamômetro.', 'Run the dyno.'),
      L('Saia e volte para Peças de Desempenho.', 'Leave and go back to Performance Parts.'),
      L('Instale o Turbo de nível 3.', 'Install the level 3 Turbo.'),
      L('Entre no dinamômetro: aparece uma barra dourada no Turbo (posição 7, 8 ou 9). Baixe essa barra só uma vez.', 'Enter the dyno: a golden bar appears in the Turbo (position 7, 8 or 9). Lower that bar only once.'),
      L('Baixe a barra 4 para encher as barras 5 a 9. Para encher a barra 4, baixe as barras 3 até 0, nessa ordem, até as barras 3 a 0 ficarem vazias.', 'Lower bar 4 to fill bars 5 to 9. To fill bar 4, lower bars 3 down to 0, in that order, until bars 3 to 0 are empty.'),
      L('Repita os passos 7 e 8; depois, os passos 12 e 13.', 'Repeat steps 7 and 8; then steps 12 and 13.'),
    ],
    note: L('Quando a barra 4 chegar ao máximo, faça o mesmo com a barra 3 (baixando as barras 2 até 0). Quando a barra 3 estiver no máximo, ou pelo menos 75% cheia, pare e vá para a parte B.',
      'When bar 4 is maxed out, do the same with bar 3 (lowering bars 2 down to 0). When bar 3 is maxed out, or at least 75% full, stop and move on to part B.'),
  };
  // Fim da parte B (2 e 3 barras): as barras douradas não podem ser mexidas.
  const DONT_TOUCH_GOLD = L('NÃO TOQUE NAS BARRAS DOURADAS: elas precisam ficar exatamente como estão para o glitch funcionar. Daqui em diante não ajuste mais a ECU nem troque peças dela.',
    'DO NOT TOUCH THE GOLDEN BARS: they must stay exactly as they are for the glitch to work. From now on, do not tune the ECU or change its parts anymore.');
  const ECU_START = [
    L('Entre em Peças de Desempenho e selecione a ECU.', 'Go to Performance Parts and select the ECU.'),
    L('Instale as quatro primeiras peças uma a uma, sem comprar os pacotes de nível.', 'Install the first four parts one by one, without buying the level packages.'),
    L('Pule o Performance Chip e instale a peça seguinte.', 'Skip the Performance Chip and install the next part.'),
    L('Pule o Engine Management e instale a última peça.', 'Skip Engine Management and install the last part.'),
    L('Entre no dinamômetro.', 'Enter the dyno.'),
  ];

  // ── Guias não oficiais: valores copiados de tutoriais da internet, sem misturar fontes (cada carro segue um só). ──
  // Para acrescentar um carro: uma entrada em CAR_SETUPS (id t + número); o aviso, o botão e a tabela saem sozinhos.
  const F = (s) => (en ? s : s.replace(/(\d)\.(\d)/g, '$1,$2'));
  const FR = L('dianteiro / traseiro', 'front / rear');
  const SRC_SCRIBD = L('tutorial em português "Tuning Dyno NFSU2" (Scribd), autor não identificado', 'Portuguese tutorial "Tuning Dyno NFSU2" (Scribd), unknown author');
  const SRC_VK = L('comunidade NFSU2 Online (VK), por "Save Myself", adaptando um setup de Afroman-00', 'NFSU2 Online community (VK), by "Save Myself", adapting a setup by Afroman-00');
  const UNOFFICIAL = L('Guia NÃO oficial e NÃO testado: os valores foram copiados de um tutorial da internet. Confira no dinamômetro e ajuste ao seu gosto.',
    'UNOFFICIAL and UNTESTED guide: the values were copied from an online tutorial. Check them on the dyno and adjust to your liking.');
  const NOT_READ = L('Não informado', 'Not available');
  const carRows = (d) => [
    {
      title: partTitles.susp,
      rows: [
        [`${L('Rebaixamento', 'Ride height')} (${FR})`, F(d.ride)],
        [`${L('Molas', 'Springs')} (${FR})`, F(d.springs)],
        [`${L('Amortecedores', 'Shocks')} (${FR})`, F(d.shocks)],
        [`${L('Barras estabilizadoras', 'Sway bars')} (${FR})`, F(d.sway)],
        [d.steerLabel || L('Relação de direção', 'Steering ratio'), F(d.steer)],
      ],
    },
    {
      title: partTitles.rest,
      rows: [
        [L('Marchas (velocidade em cada uma)', 'Gears (speed in each one)'), F(d.gears)],
        ...(d.final ? [[L('Relação final', 'Final drive'), F(d.final)]] : []),
        [`${L('Aerodinâmica', 'Aerodynamics')} (${FR})`, F(d.aero)],
        [`${L('Pneus (aderência)', 'Tires (grip)')} (${FR})`, F(d.tires)],
        [L('Distribuição de frenagem', 'Brake bias'), F(d.bias)],
      ],
    },
    { title: partTitles.tune, rows: [['ECU', d.ecu], ['Turbo', d.turbo], [L('Nitro', 'Nitrous'), d.nitro]] },
  ];
  const CAR_SETUPS = [
    {
      id: 't10', short: L('Golf: Drift', 'Golf: Drift'), name: L('VW Golf GTI: Drift', 'VW Golf GTI: Drift'), src: SRC_VK,
      mode: L('Drift (Park). Sem aerofólio, com alargador VAPOR.', 'Drift (Park). No spoiler, with VAPOR fenders.'),
      extra: [
        [L('Peças', 'Parts'), L('Todas dos pacotes 1 a 3, em ordem, menos os freios.', 'All from packages 1 to 3, in order, except the brakes.')],
        [L('Freios', 'Brakes'), L('Só a 4ª das 7 peças.', 'Only the 4th of the 7 parts.')],
      ],
      ride: '-3.58 / 0.33', springs: '0.00 / 10.00', shocks: '0.03 / 10.00', sway: '10.00 / 0.02',
      steerLabel: L('Última linha da suspensão', 'Last suspension row'),
      steer: L('1.25 (a fonte, em russo, chama de "cambagem"; no jogo pode aparecer como relação de direção)', '1.25 (the Russian source calls it "camber"; in the game it may show as steering ratio)'),
      gears: NOT_READ, aero: '0.00 / 9.98', tires: '10.00 / 0.00',
      bias: L('Perto de -0.35 (lido de uma imagem pequena: confira)', 'Around -0.35 (read from a small image: check it)'),
      ecu: L('A fonte só mostra o gráfico: barras 0 a 2 baixas, as demais altas.', 'The source only shows the graph: bars 0 to 2 low, the others high.'),
      turbo: L('A fonte só mostra o gráfico: primeiras barras baixas e subindo, altas a partir da barra 5.', 'The source only shows the graph: first bars low and rising, high from bar 5 on.'),
      nitro: NOT_READ,
    },
    {
      id: 't11', short: 'Skyline', name: 'Nissan Skyline', src: SRC_SCRIBD, mode: L('A fonte não diz o modo de jogo.', 'The source does not name the race mode.'),
      ride: '-3.30 / -3.30', springs: '1.55 / 1.71', shocks: '3.33 / 3.93', sway: '4.41 / 7.92', steer: '0.95',
      gears: '108.7 · 187.7 · 255.8 · 327.0 · 347.9 · 370.7 km/h', aero: '8.70 / 8.99', tires: '10 / 10', bias: '0.50',
      ecu: L('Baixar as barras na ordem 1, 2, 1.', 'Lower the bars in the order 1, 2, 1.'),
      turbo: L('A fonte só diz "ordem 4.5.2.5.4".', 'The source only says "order 4.5.2.5.4".'),
      nitro: L('Baixar 1 ponto.', 'Lower by 1 point.'),
    },
    {
      id: 't12', short: 'Celica', name: 'Toyota Celica', src: SRC_SCRIBD, mode: L('A fonte não diz o modo de jogo.', 'The source does not name the race mode.'),
      ride: '-3.84 / -3.84', springs: '1.85 / 1.41', shocks: '1.53 / 1.53', sway: '1.62 / 0.54', steer: '1.00',
      gears: '82.6 · 122.3 · 204.1 · 272.2 · 312.9 · 347.3 km/h', final: '3.70', aero: '10 / 10', tires: '10 / 10', bias: '0.17',
      ecu: L('Subir as barras 3 a 9 até o fim; barras 1 e 2 equilibradas.', 'Fully raise bars 3 to 9; keep bars 1 and 2 balanced.'),
      turbo: L('Baixar as barras 1 a 3 e subir as barras 5 a 9.', 'Lower bars 1 to 3 and raise bars 5 to 9.'),
      nitro: L('Baixar 2 pontos (lado da potência).', 'Lower by 2 points (power side).'),
    },
    {
      id: 't13', short: L('350Z: Veloc.', '350Z: Speed'), name: L('Nissan 350Z: velocidade máxima', 'Nissan 350Z: top speed'), src: SRC_SCRIBD,
      mode: L('Velocidade máxima. A fonte diz ter chegado a 397,2 km/h.', 'Top speed. The source claims 397.2 km/h.'),
      ride: '-2.53 / -2.52', springs: '2.75 / 1.64', shocks: '3.33 / 3.33', sway: '3.61 / 2.98', steer: '1.00',
      gears: '91.8 · 147.0 · 210.6 · 268.1 · 310.2 · 376.3 km/h', final: '3.00', aero: '5.90 / 5.92', tires: '10 / 10', bias: '0.00',
      ecu: L('Subir as barras 4 a 9.', 'Raise bars 4 to 9.'),
      turbo: L('Subir as barras 5 a 9 e deixar as barras 1 a 3 baixas.', 'Raise bars 5 to 9 and keep bars 1 to 3 low.'),
      nitro: L('Baixar 1 ponto.', 'Lower by 1 point.'),
    },
    {
      id: 't14', short: L('Golf: Veloc.', 'Golf: Speed'), name: L('VW Golf GTI: velocidade máxima', 'VW Golf GTI: top speed'), src: SRC_SCRIBD,
      mode: L('Velocidade máxima. A fonte diz ter chegado a 386,4 km/h.', 'Top speed. The source claims 386.4 km/h.'),
      ride: '-3.55 / -3.56', springs: '1.60 / 1.85', shocks: '3.63 / 3.93', sway: '6.46 / 5.87', steer: '1.03',
      gears: '89.8 · 160.1 · 232.8 · 299.4 · 341.5 · 364.5 km/h', final: '3.45', aero: '5.88 / 5.90', tires: '10 / 10', bias: '0.50',
      ecu: L('Baixar as barras 1 e 2 e subir as barras 4 a 9.', 'Lower bars 1 and 2 and raise bars 4 to 9.'),
      turbo: L('Baixar as barras 1 a 3 e subir as barras 5 a 9.', 'Lower bars 1 to 3 and raise bars 5 to 9.'),
      nitro: L('Baixar 1 ponto.', 'Lower by 1 point.'),
    },
    {
      id: 't15', short: 'Miata', name: 'Mazda Miata MX-5', src: SRC_SCRIBD, mode: L('A fonte não diz o modo de jogo.', 'The source does not name the race mode.'),
      ride: '-3.18 / -3.18', springs: '2.15 / 2.15', shocks: '2.43 / 2.43', sway: '2.52 / 1.34', steer: '1.00',
      gears: '74.7 · 123.0 · 183.0 · 247.7 · 311.9 · 346.4 km/h', final: '3.50', aero: '10 / 10', tires: '10 / 10', bias: '0.31',
      ecu: L('Baixar as barras 4 e 5 e subir as demais.', 'Lower bars 4 and 5 and raise the others.'),
      turbo: L('Baixar as barras 1 a 3 e subir as barras 5 a 9.', 'Lower bars 1 to 3 and raise bars 5 to 9.'),
      nitro: L('Baixar 2 pontos.', 'Lower by 2 points.'),
    },
  ];
  const carParts = (d) => [
    { title: L('Aviso', 'Notice'), steps: [UNOFFICIAL, `${L('Fonte', 'Source')}: ${d.src}.`, d.mode] },
    ...(d.extra ? [{ title: L('Peças', 'Parts'), rows: d.extra }] : []),
    ...carRows(d),
  ];
  const CAR_GUIDES = CAR_SETUPS.map((d) => ({
    id: d.id, group: 'cars', short: d.short, title: `${d.name} ${L('(não oficial)', '(unofficial)')}`,
    end: L('Pronto! Lembre: guia não oficial e não testado. Confira o resultado no dinamômetro.', 'Done! Remember: unofficial and untested guide. Check the result on the dyno.'),
    parts: carParts(d),
  }));
  const carBlocks = () => [
    { note: `${UNOFFICIAL} ${L('Não são do jogo nem do autor do app. Aqui só tem ajuste: o carro e as peças você conquista jogando.', 'They are not from the game or the app author. These are settings only: you earn the car and the parts by playing.')}` },
    { p: L('Foram procuradas de 2 a 3 fontes para cada carro, sem misturar: cada guia segue um tutorial só. Dos carros abaixo, só foi achada uma fonte com números para cada ajuste.',
      'We looked for 2 to 3 sources for each car, without mixing them: each guide follows a single tutorial. For the cars below, only one source with numbers was found for each setup.') },
    { h: L('Drift: use o Golf GTI', 'Drift: use the Golf GTI') },
    { p: L('O Golf GTI é o carro de drift mais recomendado pela comunidade do jogo, em vários guias e fóruns.', 'The Golf GTI is the drift car most recommended by the game community, across several guides and forums.') },
    ...CAR_SETUPS.flatMap((d, i) => {
      const parts = carParts(d).slice(1);
      return [
        ...(i === 1 ? [{ h: L('Outros carros', 'Other cars') }] : []),
        { h: d.name },
        { p: `${d.mode} ${L('Fonte', 'Source')}: ${d.src}.` },
        { guide: d.id },
        { kv: parts.flatMap((p) => p.rows) },
      ];
    }),
    { h: L('Ainda sem guia', 'No guide yet') },
    { p: L('Não foi achada uma configuração com números, em fonte aberta, para: Mazda RX-7, Nissan 240SX, Subaru Impreza, Mitsubishi Lancer, Pontiac GTO, Ford Mustang, Acura RSX, Honda Civic e Cadillac Escalade. O Corolla AE86 tem aba própria.',
      'No setup with numbers was found in an open source for: Mazda RX-7, Nissan 240SX, Subaru Impreza, Mitsubishi Lancer, Pontiac GTO, Ford Mustang, Acura RSX, Honda Civic and Cadillac Escalade. The Corolla AE86 has its own tab.') },
  ];

  const COROLLA_SKIP = L('Vai fazer o glitch no Toyota Corolla? Pule 1 e 2 barras e vá direto para o guia de 3 barras.',
    'Doing the glitch on the Toyota Corolla? Skip 1 and 2 bars and go straight to the 3 bars guide.');
  const GUIDES = [
    ...CAR_GUIDES,
    {
      id: 't1', group: 'ae86', short: L('Peças', 'Parts'), title: L('AE86: peças', 'AE86: parts'),
      // Fim do guia: mensagem própria e botão para o próximo guia.
      end: L('Peças instaladas! Agora entre no dinamômetro (Dyno) para fazer a regulagem.', 'Parts installed! Now enter the dyno to do the tuning.'),
      next: 't2', nextLabel: L('Ir para Circuito', 'Go to Circuit'),
      parts: [
        { title: L('Peças', 'Parts'), rows: AE86_PARTS },
        { title: L('Peças exclusivas', 'Unique parts'), rows: AE86_UNIQUE },
        { title: L('Potência máxima (confira no dinamômetro)', 'Max power (check on the dyno)'), rows: AE86_POWER, note: AE86_POWER_NOTE },
      ],
    },
    {
      id: 't2', group: 'ae86', short: L('Circuito', 'Circuit'), title: L('AE86: Circuito e Street-X', 'AE86: Circuit and Street-X'), parts: setup(CIRCUIT),
      end: L('Circuito e Street-X prontos! Próximo: a regulagem de Arrancada.', 'Circuit and Street-X done! Next: the Drag tuning.'),
      next: 't3', nextLabel: L('Ir para Arrancada', 'Go to Drag'),
    },
    {
      id: 't3', group: 'ae86', short: L('Arrancada', 'Drag'), title: L('AE86: Arrancada (Drag)', 'AE86: Drag'), parts: setup(DRAG),
      end: L('Arrancada pronta! Dica: faça também o glitch da ECU (barras douradas) para tirar mais potência do carro.', 'Drag done! Tip: also do the ECU glitch (golden bars) to get more power out of the car.'),
      next: 'g1', nextLabel: L('Glitch da ECU', 'ECU glitch'),
    },
    {
      id: 'g1', group: 'glitch', short: L('1 barra', '1 bar'), title: L('Uma barra dourada na ECU', 'One golden bar on the ECU'),
      end: L('Uma barra dourada pronta! Próximo: o glitch de duas barras douradas.', 'One golden bar done! Next: the two golden bars glitch.'),
      next: 'g2', nextLabel: L('Ir para 2 barras', 'Go to 2 bars'),
      parts: [{
        title: 'ECU',
        noteFirst: COROLLA_SKIP,
        steps: [
          L('Instale a ECU de nível 1.', 'Install the level 1 ECU.'),
          L('Entre no dinamômetro (Dyno) e, na regulagem da ECU, baixe a primeira barra até o fim.', 'Enter the dyno and, in the ECU tuning, fully lower the first bar.'),
          L('Instale as ECUs de nível 2 e nível 3.', 'Install the level 2 and level 3 ECUs.'),
          L('Entre de novo no dinamômetro: deve aparecer uma barra dourada na ECU.', 'Enter the dyno again: a golden bar should appear on the ECU.'),
        ],
      }],
    },
    {
      id: 'g2', group: 'glitch', short: L('2 barras', '2 bars'), title: L('Duas barras douradas', 'Two golden bars'),
      end: L('Duas barras douradas prontas! Próximo: o glitch de três barras douradas (só no Toyota Corolla).', 'Two golden bars done! Next: the three golden bars glitch (Toyota Corolla only).'),
      next: 'g3', nextLabel: L('Ir para 3 barras', 'Go to 3 bars'),
      parts: [TURBO_PREP, {
        title: L('Parte B — glitch da ECU', 'Part B — ECU glitch'),
        steps: [
          ...ECU_START,
          L('Na ECU, baixe até o fim as duas primeiras barras. Se elas não descerem, a parte A não foi feita por tempo suficiente.', 'In the ECU tuning, fully lower the first two bars. If they will not go down, you did not do part A long enough.'),
          L('Rode o dinamômetro.', 'Run the dyno.'),
          L('Saia e volte para Peças de Desempenho.', 'Leave and go back to Performance Parts.'),
          L('Instale o Performance Chip e depois o Engine Management, obrigatoriamente nessa ordem.', 'Install the Performance Chip and then Engine Management, in that exact order.'),
          L('Entre no dinamômetro: devem aparecer duas barras douradas nas duas primeiras posições da ECU (normalmente as barras são azuis; dourada quer dizer que o glitch funcionou).', 'Enter the dyno: two golden bars should appear in the first two ECU positions (bars are normally blue; golden means the glitch worked).'),
        ],
        note: DONT_TOUCH_GOLD,
      }],
    },
    {
      id: 'g3', group: 'glitch', short: L('3 barras', '3 bars'), title: L('Três barras douradas (só no Toyota Corolla)', 'Three golden bars (Toyota Corolla only)'),
      intro: L('É o glitch de duas barras com mudanças na parte B e uma parte C (ajuste final do Turbo). A parte A (Turbo) é igual.',
        'It is the two-bar glitch with changes in part B plus a part C (final Turbo tuning). Part A (Turbo) is the same.'),
      end: L('Todos os glitches concluídos! Bom jogo!', 'All glitches done! Have fun!'),
      parts: [TURBO_PREP, {
        title: L('Parte B — preparação da ECU', 'Part B — ECU preparation'),
        steps: [
          ...ECU_START,
          L('Na ECU, baixe até o fim as duas primeiras barras. Se não descerem, faça a preparação do Turbo por mais tempo.', 'In the ECU tuning, fully lower the first two bars. If they will not go down, do the turbo preparation longer.'),
          L('Rode o dinamômetro.', 'Run the dyno.'),
          L('Ainda NÃO instale o Performance Chip nem o Engine Management.', 'Do NOT install the Performance Chip or Engine Management yet.'),
          L('No Turbo, baixe a última barra até o fim e rode o dinamômetro.', 'In the Turbo tuning, fully lower the last bar and run the dyno.'),
          L('A última barra terá um pouco de azul. Baixe-a uma vez e rode o dinamômetro; volte à mesma barra, baixe mais uma vez e rode de novo. Continue alternando até todas as barras estarem cheias, menos a última.', 'The last bar will have a little blue fill. Lower it once and run the dyno; go back to the same bar, lower it once more and run again. Keep alternating until every bar is full except the last one.'),
          L('Volte para a ECU e baixe a terceira barra. Se as barras 1 e 2 subirem de novo, continue baixando as três primeiras até o azul sumir.', 'Go back to the ECU and lower the third bar. If bars 1 and 2 rise again, keep lowering the first three until the blue fill is gone.'),
          L('Instale o Performance Chip e depois o Engine Management, nessa ordem.', 'Install the Performance Chip and then Engine Management, in that order.'),
          L('Na ECU aparecem duas barras douradas. Não existe uma terceira barra dourada de verdade: a terceira fica simplesmente cheia.', 'Two golden bars appear on the ECU. There is no real third golden bar: the third bar is simply completely full.'),
        ],
        note: `${DONT_TOUCH_GOLD} ${L('Agora siga para a parte C (Turbo).', 'Now move on to part C (Turbo).')}`,
      }, {
        title: L('Parte C — ajuste final do Turbo', 'Part C — final Turbo tuning'),
        steps: [
          L('Volte ao dinamômetro, abra a regulagem do Turbo e clique em Restaurar padrão. Atenção: só no Turbo — NÃO mexa na ECU nem nas barras douradas dela.',
            'Go back to the dyno, open the Turbo tuning and click Restore default. Careful: Turbo only — do NOT touch the ECU or its golden bars.'),
          L('Baixe ao máximo as últimas barras da direita, até as barras da esquerda subirem.', 'Lower the last bars on the right as far as they go, until the bars on the left rise.'),
          L('Rode o dinamômetro.', 'Run the dyno.'),
          L('Saia do dinamômetro e, em Peças de Desempenho, instale o Turbo de nível 1.', 'Leave the dyno and, in Performance Parts, install the level 1 Turbo.'),
          L('Volte ao dinamômetro: no Turbo, suba todas as barras da direita e baixe todas as da esquerda. Rode o dinamômetro.', 'Go back to the dyno: in the Turbo tuning, raise all the bars on the right and lower all the bars on the left. Run the dyno.'),
          L('Saia, instale o Turbo de nível 3, volte ao dinamômetro, baixe as barras da direita e rode o dinamômetro.', 'Leave, install the level 3 Turbo, go back to the dyno, lower the bars on the right and run the dyno.'),
          L('Saia, instale o Turbo de nível 1, volte ao dinamômetro, suba as barras da direita e rode o dinamômetro.', 'Leave, install the level 1 Turbo, go back to the dyno, raise the bars on the right and run the dyno.'),
          L('Repita os passos 6 e 7 até restarem 2 barras e meia na direita com o Turbo de nível 1.', 'Repeat steps 6 and 7 until 2 and a half bars are left on the right with the level 1 Turbo.'),
          L('Quando restarem as 2 barras e meia: instale o Turbo de nível 3, suba as últimas barras da direita e rode o dinamômetro.', 'When the 2 and a half bars are left: install the level 3 Turbo, raise the last bars on the right and run the dyno.'),
        ],
        note: L('Confira o resultado no dinamômetro: o torque máximo deve estar perto de 8.000 RPM ou acima, e a potência máxima perto de 9.000 RPM. Não mexa nas barras douradas da ECU.',
          'Check the result on the dyno: max torque should be at around 8,000 RPM or higher, and max power at around 9,000 RPM. Do not touch the golden ECU bars.'),
      }],
    },
  ];
  const GROUP_TITLES = { ae86: L('Tuning AE86', 'AE86 tuning'), glitch: L('Glitches do Dyno', 'Dyno glitches'), cars: L('Guias não oficiais', 'Unofficial guides') };
  const byId = (id) => GUIDES.find((g) => g.id === id);

  // Aba "Glitches": texto completo de cada guia e o botão do passo a passo.
  const glitchBlocks = () => {
    const blocks = [{ note: COROLLA_SKIP }, { p: L('Faça com calma: abra o passo a passo e marque "Feito" a cada etapa. A janela fica por cima do jogo, não tira o teclado e pode ser recolhida para a borda do jogo.',
      'Take it slow: open the step-by-step guide and press "Done" after each step. The window stays over the game, does not take the keyboard away from it and can be tucked into the edge of the game.') }];
    GUIDES.filter((g) => g.group === 'glitch').forEach((g, i) => {
      blocks.push({ h: `${i + 1}. ${g.title}` });
      if (g.intro) blocks.push({ p: g.intro });
      blocks.push({ guide: g.id });
      for (const part of g.parts) {
        if (g.parts.length > 1) blocks.push({ p: part.title });
        blocks.push({ ol: part.steps });
        if (part.note) blocks.push({ note: part.note });
      }
    });
    return blocks;
  };
  // Aba "Tuning AE86": as mesmas tabelas dos guias t1–t3, cada seção com o botão do passo a passo.
  const ae86Blocks = () => {
    const t1 = byId('t1');
    const kvOf = (g) => ({ kv: g.parts.flatMap((p) => p.rows) });
    return [
      { p: L('Toyota Corolla AE86 (Hachi-roku). Cada parte abaixo também abre como guia passo a passo numa janela flutuante, para seguir com o jogo aberto.',
        'Toyota Corolla AE86 (Hachi-roku). Each section below also opens as a step-by-step guide in a floating window, so you can follow it with the game open.') },
      { h: L('Peças', 'Parts') }, { guide: 't1' },
      { kv: t1.parts[0].rows },
      { h: L('Peças exclusivas', 'Unique parts') }, { kv: t1.parts[1].rows },
      { h: L('Potência máxima', 'Max power') }, { kv: t1.parts[2].rows }, { note: t1.parts[2].note },
      { h: L('Circuito e Street-X', 'Circuit and Street-X') }, { guide: 't2' }, kvOf(byId('t2')),
      { h: L('Arrancada (Drag), qualquer porcentagem', 'Drag (any percentage)') }, { guide: 't3' }, kvOf(byId('t3')),
      { h: 'Visual' },
      { p: L('Peças visuais (capô de carbono, entradas de ar, alto-falantes, neon, kits wide body etc.) não mudam o desempenho. Só para-choques e aerofólios contam: quanto maior o estágio, mais downforce dá para ajustar no dinamômetro.',
        'Visual upgrades (carbon hoods, hood scoops, speakers, neons, wide body kits etc.) do not affect performance. Only bumpers and spoilers do: the higher the stage, the more downforce you can set on the dyno.') },
    ];
  };

  const TABS = [
    { id: 'ae86', title: L('Tuning: Corolla AE86', 'Tuning: Corolla AE86'), blocks: ae86Blocks() },
    { id: 'glitches', title: L('Glitches do Dyno (barras douradas)', 'Dyno glitches (golden bars)'), blocks: glitchBlocks() },
    { id: 'carros', title: L('Outros carros (não oficial)', 'Other cars (unofficial)'), blocks: carBlocks() },
  ];

  // Textos fixos da tela de dicas e da janela do guia.
  const UI = {
    tips: L('Dicas', 'Tips'), back: L('Voltar', 'Back'), keysHint: L('Ctrl+Alt+I abre e fecha · Esc volta', 'Ctrl+Alt+I opens and closes · Esc goes back'),
    openGuide: L('Abrir o passo a passo', 'Open step by step'),
    seeAll: L('Ver tudo', 'See all'), stepByStep: L('Passo a passo', 'Step by step'),
    toTips: L('Dicas', 'Tips'), toTipsTitle: L('Voltar à tela de Dicas do app', 'Back to the app Tips screen'),
    fontDown: L('Diminuir a letra', 'Smaller text'), fontUp: L('Aumentar a letra', 'Larger text'),
    prev: L('Anterior', 'Back'), done: L('Feito', 'Done'), gotIt: L('Entendi', 'Got it'), restart: L('Recomeçar', 'Start over'),
    attention: L('Atenção', 'Note'), finished: L('Concluído', 'Finished'),
    endGlitch: L('Guia concluído! Confira o resultado no dinamômetro.', 'Guide finished! Check the result on the dyno.'),
    endTune: L('Pronto! Tudo ajustado.', 'Done! Everything is set.'),
    jump: L('Clique para ir a esta etapa', 'Click to go to this step'),
    dock: L('Recolher para a borda do jogo (passe o mouse lá para reabrir)', 'Tuck into the edge of the game (hover there to bring it back)'),
    close: L('Fechar', 'Close'), opacity: L('Transparência da janela', 'Window transparency'),
    widthGrip: L('Arraste para mudar a largura (a altura se ajusta ao texto)', 'Drag to change the width (the height follows the text)'),
    language: L('Idioma das dicas', 'Tips language'),
  };
  return { TABS, GUIDES, GROUP_TITLES, UI };
}

// Lista plana de passos de um guia (o aviso da parte vira um passo "Atenção" no fim dela).
function guideSteps(guide) {
  const out = [];
  for (const part of guide.parts) {
    if (part.noteFirst) out.push({ part: part.title, n: null, text: part.noteFirst, note: true });
    const items = part.rows ? part.rows.map(([k, v]) => `${k}: ${v}`) : part.steps;
    items.forEach((text, i) => out.push({ part: part.title, n: i + 1, text }));
    if (part.note) out.push({ part: part.title, n: null, text: part.note, note: true });
  }
  return out;
}

// Idioma escolhido: guardado no armazenamento das páginas locais (compartilhado entre a tela de dicas e o guia).
const LANG_KEY = 'nfsu2-tips-lang';
function getLang() { try { return LANGS.includes(localStorage.getItem(LANG_KEY)) ? localStorage.getItem(LANG_KEY) : 'pt'; } catch { return 'pt'; } }
function setLang(l) { try { if (LANGS.includes(l)) localStorage.setItem(LANG_KEY, l); } catch { /* sem armazenamento */ } }

// Tamanho da letra das dicas e dos guias (A− / A+), compartilhado pelas páginas locais como o idioma.
// 1 = tamanho original; o padrão é 20% maior (pedido do usuário). Passos de 10%, de 80% a 200%.
const FONT_KEY = 'nfsu2-tips-font';
const FONT = { def: 1.2, min: 0.8, max: 2, step: 0.1 };
const fontClamp = (v) => Math.round(Math.min(FONT.max, Math.max(FONT.min, v)) * 10) / 10;
function getFont() {
  try { const v = Number(localStorage.getItem(FONT_KEY)); return v ? fontClamp(v) : FONT.def; } catch { return FONT.def; }
}
function setFont(v) { const f = fontClamp(v); try { localStorage.setItem(FONT_KEY, String(f)); } catch { /* sem armazenamento */ } return f; }
// Aplica na página: as folhas de estilo usam var(--fs).
function applyFont(doc, v) { doc.documentElement.style.setProperty('--fs', String(v)); }

const PT = build('pt');
const api = { build, guideSteps, LANGS, LANG_KEY, getLang, setLang, FONT_KEY, FONT, fontClamp, getFont, setFont, applyFont, TABS: PT.TABS, GUIDES: PT.GUIDES, GROUP_TITLES: PT.GROUP_TITLES };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else globalThis.Tips = api;
})();
