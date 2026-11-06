@echo off
rem Baixa o codigo do Electron e do Chromium em C:\e (nao precisa de administrador).
setlocal
set ROOT=C:\e
set TAG=v45.1.0
set DEPOT_TOOLS_WIN_TOOLCHAIN=0
set DEPOT_TOOLS_UPDATE=1
set GIT_CONFIG_GLOBAL=%ROOT%\gitconfig
set PATH=%ROOT%\git\cmd;%ROOT%\depot_tools;%PATH%
set GIT_URL=https://github.com/git-for-windows/git/releases/download/v2.56.0.windows.4/PortableGit-2.56.0.4-64-bit.7z.exe
set GIT_SHA=b1f3e52216e2ed6882d1bebfd4d3fdf319bec40d2edbbf9fd26ec4fd3fce7ed1

if not exist %ROOT% mkdir %ROOT%
cd /d %ROOT%

rem Git portatil: fica so dentro de C:\e, nada e instalado no Windows.
if exist %ROOT%\git\cmd\git.exe goto git_ok
echo === git portatil
curl.exe -fsSL --retry 5 -o PortableGit.exe %GIT_URL% || goto falhou
certutil -hashfile PortableGit.exe SHA256 | findstr /i /x %GIT_SHA% >nul || goto falhou
"%ROOT%\PortableGit.exe" -o"%ROOT%\git" -y || goto falhou
del PortableGit.exe
:git_ok

if exist %ROOT%\depot_tools\gclient.bat goto tools_ok
echo === depot_tools
curl.exe -fsSL --retry 5 -o depot_tools.zip https://storage.googleapis.com/chrome-infra/depot_tools.zip || goto falhou
mkdir depot_tools
tar -xf depot_tools.zip -C depot_tools || goto falhou
del depot_tools.zip
:tools_ok

echo === preparando as ferramentas
call gclient --version || goto falhou
call git config --global core.longpaths true
call git config --global core.autocrlf false
call git config --global core.filemode false
call git config --global core.preloadindex true
call git config --global core.fscache true
call git config --global user.name "NFS Launcher"
call git config --global user.email "build@nfs-launcher.invalid"

if exist %ROOT%\src\electron\.git goto clone_ok
echo === electron %TAG%
call git clone --depth 1 --branch %TAG% https://github.com/electron/electron src\electron || goto falhou
:clone_ok

if exist %ROOT%\.gclient goto cfg_ok
rem As modificacoes do Electron so podem ser aplicadas uma vez: a etapa final nao as repete (apply_patches), quem aplica e o bloco abaixo.
call gclient config --name "src/electron" --unmanaged --custom-var=apply_patches=False https://github.com/electron/electron || goto falhou
:cfg_ok

rem Com o codigo ja baixado, repetir o sync faz o git buscar o historico inteiro do Chromium: so o que falhou e repetido.
set /a TENTATIVA=0
:sync
if exist %ROOT%\.sync-ok goto hooks
set /a TENTATIVA+=1
echo === sync, tentativa %TENTATIVA% - %DATE% %TIME%
call gclient sync --no-history -D --force --nohooks
if not errorlevel 1 (type nul > %ROOT%\.sync-ok & goto hooks)
if %TENTATIVA% geq 6 goto falhou
timeout /t 120 /nobreak >nul
goto sync

:hooks
if exist %ROOT%\.patches-ok goto patches_ok
echo === modificacoes do Electron
call python3 src\electron\script\apply_all_patches.py src\electron\patches\config.json || goto falhou
call python3 "%~dp0limpar-patches.py" %ROOT% || goto falhou
type nul > %ROOT%\.patches-ok
:patches_ok

set /a TENTATIVA=0
:hooks_de_novo
set /a TENTATIVA+=1
echo === etapa final, tentativa %TENTATIVA% - %DATE% %TIME%
call gclient runhooks
if not errorlevel 1 goto pronto
if %TENTATIVA% geq 3 goto falhou
timeout /t 120 /nobreak >nul
goto hooks_de_novo

:pronto
echo FIM codigo=0
exit /b 0
:falhou
echo FIM codigo=1
exit /b 1
