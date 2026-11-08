'use strict';
// Abre o launcher no motor de treino com dados separados: nunca usa a pasta de saves do app instalado.
const path = require('path');
const { app } = require('electron');

if (!process.env.NFS_TREINO) throw new Error('Sem NFS_TREINO: abra pelo treinar.cmd.');
const dados = path.join(process.env.NFS_TREINO, 'dados');
const raiz = path.join(__dirname, '..');
app.setPath('appData', dados);
process.argv.splice(1, process.argv.length, raiz);
if (!app.getPath('userData').startsWith(dados)) throw new Error('Pasta de dados errada: o treino não abre.');
// O app reabre sozinho ao ligar as texturas ou o DirectX 11: a cópia nova também passa por aqui (com os dados do treino),
// nunca direto pelo main.js, que usaria a pasta do app instalado.
const relaunch = app.relaunch.bind(app);
app.relaunch = () => relaunch({ args: [__filename] });
require(path.join(raiz, 'src', 'main', 'main.js'));
