#!/usr/bin/env bash
# Roda o build.sh e, se a compilação falhar (por exemplo, falta de memória), tenta de novo com menos
# tarefas ao mesmo tempo, do ponto onde parou. Registro em ~/motor-build.log; última linha "FIM codigo=N".
# Uso (do Windows): wsl -d NFSMotor -u builder -- bash /mnt/c/Users/bruno/Desktop/nfsu2-launcher/android-motor/watch.sh
HERE="$(cd "$(dirname "$0")" && pwd)"
LOG="$HOME/motor-build.log"
export PATH="$HOME/depot_tools:$PATH" DEPOT_TOOLS_UPDATE=0
exec >"$LOG" 2>&1
log() { echo; echo "=== $(date '+%d/%m %H:%M:%S') $* ==="; }

bash "$HERE/build.sh"; code=$?
for jobs in 6 3; do
  [ "$code" = 0 ] && break
  log "build.sh falhou (codigo=$code); nova tentativa da compilação com -j $jobs"
  if (cd "$HOME/chromium/src" && autoninja -C out/Motor -j "$jobs" chrome_public_apk); then
    bash "$HERE/build.sh"; code=$?
  else
    code=1
  fi
done
echo "FIM codigo=$code"
