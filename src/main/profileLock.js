'use strict';
// Protege os saves: só um processo por vez pode abrir a pasta de dados do jogo.
// A trava de instância única do Electron é solta quando o app começa a fechar, antes de o armazenamento fechar. Se o
// app for aberto nesse intervalo, o Chromium acha que o banco dos arquivos do jogo está corrompido e apaga a pasta
// inteira (sandbox_directory_database.cc: erro de trava → "Clearing SandboxDirectoryDatabase").
// Por isso cada cópia anota o número do seu processo e a próxima espera esse processo acabar de verdade. Trava feita
// no próprio Node não serve: o Electron encerra o Node antes de fechar o armazenamento.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

function isRunning(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

// O Windows reaproveita números de processo: só conta se o processo for deste mesmo programa.
function isSameProgram(pid) {
  return new Promise((resolve) => {
    const image = path.basename(process.execPath).toLowerCase();
    execFile('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { windowsHide: true }, (err, out) => {
      resolve(err ? true : String(out).toLowerCase().includes(`"${image}"`)); // na dúvida, espera
    });
  });
}

function readPid(pidFile) {
  try {
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    return Number.isInteger(pid) && pid > 0 && pid !== process.pid ? pid : null;
  } catch { return null; }
}

// true: a pasta é só nossa. false: a cópia antiga não saiu nem depois de encerrada; quem chama não pode abrir os dados.
async function acquire({ pidFile, killAfterMs = 15000, giveUpMs = 30000, stepMs = 100, kill = process.kill }) {
  const start = Date.now();
  const pid = readPid(pidFile);
  if (pid !== null && isRunning(pid) && await isSameProgram(pid)) {
    let killed = false;
    while (isRunning(pid)) {
      const waited = Date.now() - start;
      if (waited >= giveUpMs) return false;
      if (!killed && waited >= killAfterMs) {
        killed = true;
        try { kill(pid); } catch { /* o processo acabou de sair */ }
      }
      await new Promise((r) => setTimeout(r, stepMs));
    }
  }
  fs.writeFileSync(pidFile, String(process.pid));
  return true;
}

module.exports = { acquire };
