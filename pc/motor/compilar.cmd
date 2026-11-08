@echo off
rem Compila o Electron em C:\e\src\out\<pasta> e gera dist.zip. Prioridade normal, pedido do Bruno: o PC fica mais pesado enquanto compila.
rem Uso: compilar.cmd treino^|final^|base [so-gerar]. A base e igual a oficial.
setlocal
set ROOT=C:\e
set DEPOT_TOOLS_WIN_TOOLCHAIN=0
set DEPOT_TOOLS_UPDATE=0
set GIT_CONFIG_GLOBAL=%ROOT%\gitconfig
set CHROMIUM_BUILDTOOLS_PATH=%ROOT%\src\buildtools
set PATH=%ROOT%\git\cmd;%ROOT%\depot_tools;%PATH%
cd /d %ROOT%\src

set PASTA=Release
set ARGS=args.gn
if "%1"=="treino" (set PASTA=Treino& set ARGS=args-treino.gn)
if "%1"=="final" (set PASTA=Final& set ARGS=args-final.gn)

call python3 "%~dp0aplicar-correcoes.py" || goto falhou
if not exist out\%PASTA% mkdir out\%PASTA%
copy /y "%~dp0%ARGS%" out\%PASTA%\args.gn >nul || goto falhou
echo === gn gen %PASTA% - %DATE% %TIME%
call gn gen out\%PASTA% || goto falhou
if "%2"=="so-gerar" goto pronto

echo === compilando %PASTA% - %DATE% %TIME%
start "" /normal /b /wait cmd /c autoninja -C out\%PASTA% electron:electron_dist_zip
if errorlevel 1 goto falhou

:pronto
echo === fim - %DATE% %TIME%
echo FIM codigo=0
exit /b 0
:falhou
echo === fim - %DATE% %TIME%
echo FIM codigo=1
exit /b 1
