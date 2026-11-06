'use strict';
// Abre o launcher no motor de treino com dados separados: nunca usa a pasta de saves do app instalado.
const path = require('path');
const { app } = require('electron');

const dados = path.join(process.env.NFS_TREINO, 'dados');
const raiz = path.join(__dirname, '..');
app.setPath('appData', dados);
process.argv.splice(1, process.argv.length, raiz);
if (!app.getPath('userData').startsWith(dados)) throw new Error('Pasta de dados errada: o treino não abre.');
require(path.join(raiz, 'src', 'main', 'main.js'));
