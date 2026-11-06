; Preferência de GPU do Windows 11 (Configurações > Sistema > Vídeo > Elementos gráficos):
; marca ESTE app como "Alto desempenho" (GPU dedicada em notebooks híbridos).
; Configuração por usuário (HKCU), visível e reversível no Windows, removida na desinstalação.
!macro customInstall
  WriteRegStr HKCU "Software\Microsoft\DirectX\UserGpuPreferences" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "GpuPreference=2;"
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\DirectX\UserGpuPreferences" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
!macroend
