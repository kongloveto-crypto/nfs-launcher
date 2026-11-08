@echo off
rem Soma o perfil oficial do Electron ao treino no jogo. Peso 3 no oficial: cada um fica com perto de metade do total,
rem para o jogo ganhar sem o resto do navegador virar codigo frio. Resultado em out\nfs-jogo.profdata (args-final.gn).
setlocal
set SRC=C:\e\src
set LLVM=%SRC%\third_party\llvm-coverage-tools\bin\llvm-profdata.exe
set OFICIAL=%SRC%\electron\build\pgo_profiles\electron-win-x64-1792784096-2e3374f8d5.profdata
"%LLVM%" merge -o "%SRC%\out\nfs-so-jogo.profdata" C:\e\treino\perfil\*.profraw || exit /b 1
"%LLVM%" merge -o "%SRC%\out\nfs-jogo.profdata" -weighted-input=3,"%OFICIAL%" -weighted-input=1,"%SRC%\out\nfs-so-jogo.profdata" || exit /b 1
"%LLVM%" show "%SRC%\out\nfs-jogo.profdata"
