; Preferência de GPU do Windows 11 (Configurações > Sistema > Vídeo > Elementos gráficos):
; marca ESTE app como "Alto desempenho" (GPU dedicada em notebooks híbridos).
; Configuração por usuário (HKCU), visível e reversível no Windows, removida na desinstalação.
;
; Desde a 3.0.3 (pedido do Bruno, 08/11) o instalador não traz texturas: o jogador baixa os mods pelo próprio app
; (janela "Texturas HD"), e eles ficam na pasta de dados, que a atualização não apaga.
;
; Atualização automática (o app roda este instalador com /S --updated): antes de trocar os arquivos, espera o app
; fechar sozinho (até ~30 s), para não encerrá-lo enquanto ele ainda grava os dados do jogo. Só depois disso, se ainda
; estiver aberto, segue o caminho normal do instalador (pede para fechar e encerra).
!include LogicLib.nsh
!include "getProcessInfo.nsh"
Var pid

!macro customCheckAppRunning
  !insertmacro IS_POWERSHELL_AVAILABLE
  ${if} ${isUpdated}
    StrCpy $R2 0
    nfsWaitApp:
      !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
      ${if} $R0 == 0
      ${andIf} $R2 < 30
        IntOp $R2 $R2 + 1
        Sleep 1000
        Goto nfsWaitApp
      ${endIf}
  ${endIf}
  !insertmacro _CHECK_APP_RUNNING
!macroend

!macro customInstall
  WriteRegStr HKCU "Software\Microsoft\DirectX\UserGpuPreferences" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "GpuPreference=2;"
  ; Texturas das versões 3.0.0 a 3.0.2 (vinham dentro do programa): a escolha antiga do instalador não vale mais.
  DeleteRegKey HKCU "Software\NFS Launcher"
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\DirectX\UserGpuPreferences" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  DeleteRegKey HKCU "Software\NFS Launcher"
!macroend
