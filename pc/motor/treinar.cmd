@echo off
rem Abre o launcher no motor de treino. Fechar pelo X da janela: e ao fechar que o treino e gravado.
setlocal
if not defined NFS_TREINO set NFS_TREINO=C:\e\treino
set LLVM_PROFILE_FILE=%NFS_TREINO%\perfil\electron-%%4m.profraw
set ELECTRON_RUN_AS_NODE=
echo Treino aberto. Jogue um trecho e feche pelo X da janela do jogo.
"C:\e\src\out\Treino\electron.exe" %* "%~dp0treinar.js"
echo Treino fechado, codigo %ERRORLEVEL%.
