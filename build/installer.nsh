; Preferência de GPU do Windows 11 (Configurações > Sistema > Vídeo > Elementos gráficos):
; marca ESTE app como "Alto desempenho" (GPU dedicada em notebooks híbridos).
; Configuração por usuário (HKCU), visível e reversível no Windows, removida na desinstalação.
;
; Texturas HD do NFSU2 (pedido do Bruno, 06/11): página própria depois da pasta, com a caixa "Instalar as texturas HD"
; (marcada por padrão). Desmarcada, o instalador tira resources\mods depois de copiar (o app então roda sem pacote e
; desfaz a linha ui_textures que tinha gravado). A escolha fica em HKCU\Software\NFS Launcher\TexturasHD ("1"/"0")
; e volta marcada assim na próxima atualização. Os textos ficam em português ou inglês, conforme o idioma do instalador.
!include nsDialogs.nsh
!include LogicLib.nsh

!define NFS_KEY "Software\NFS Launcher"

!ifndef BUILD_UNINSTALLER
  Var TexWant ; "1" instala as texturas, "0" não. Lida ao abrir o instalador (antes de a versão antiga sair)
  Var TexBox

  !macro customInit
    ReadRegStr $TexWant HKCU "${NFS_KEY}" "TexturasHD"
    ${If} $TexWant != "0"
      StrCpy $TexWant "1"
    ${EndIf}
  !macroend

  !macro customPageAfterChangeDir
    Page custom TexPageShow TexPageLeave

    Function TexPageShow
      nsDialogs::Create 1018
      Pop $0
      ${If} $0 == error
        Abort
      ${EndIf}
      ${If} $LANGUAGE == 1046
        !insertmacro MUI_HEADER_TEXT "Texturas HD" "Need for Speed: Underground 2"
        ${NSD_CreateLabel} 0 0 100% 72u "Texturas melhores para as ruas, calçadas, pistas, céu e carros do NFSU2, de mods da comunidade. Deixam o jogo mais bonito, mas pesam mais na placa de vídeo e deixam o primeiro carregamento mais lento.$\r$\n$\r$\nEm PC com placa de vídeo integrada ou antiga (sem DirectX 12), deixe desmarcado. Sem elas, o jogo fica com as texturas originais. Para mudar de ideia depois, é só instalar de novo."
        Pop $0
        ${NSD_CreateCheckbox} 0 82u 100% 14u "Instalar as texturas HD (cerca de 390 MB a mais no disco)"
        Pop $TexBox
      ${Else}
        !insertmacro MUI_HEADER_TEXT "HD textures" "Need for Speed: Underground 2"
        ${NSD_CreateLabel} 0 0 100% 72u "Better textures for the NFSU2 streets, sidewalks, tracks, sky and cars, from community mods. They make the game look better, but are heavier on the graphics card and make the first load slower.$\r$\n$\r$\nOn a PC with integrated or old graphics (no DirectX 12), leave this unchecked. Without them the game keeps its original textures. To change your mind later, just install again."
        Pop $0
        ${NSD_CreateCheckbox} 0 82u 100% 14u "Install the HD textures (about 390 MB more on disk)"
        Pop $TexBox
      ${EndIf}
      ${If} $TexWant == "1"
        ${NSD_Check} $TexBox
      ${EndIf}
      nsDialogs::Show
    FunctionEnd

    Function TexPageLeave
      ${NSD_GetState} $TexBox $0
      ${If} $0 == ${BST_CHECKED}
        StrCpy $TexWant "1"
      ${Else}
        StrCpy $TexWant "0"
      ${EndIf}
    FunctionEnd
  !macroend
!endif

!macro customInstall
  WriteRegStr HKCU "Software\Microsoft\DirectX\UserGpuPreferences" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "GpuPreference=2;"
  ${If} $TexWant == "0"
    RMDir /r "$INSTDIR\resources\mods"
    WriteRegStr HKCU "${NFS_KEY}" "TexturasHD" "0"
  ${Else}
    WriteRegStr HKCU "${NFS_KEY}" "TexturasHD" "1"
  ${EndIf}
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\DirectX\UserGpuPreferences" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  DeleteRegKey HKCU "${NFS_KEY}"
!macroend
