; Preferência de GPU do Windows 11 (Configurações > Sistema > Vídeo > Elementos gráficos):
; marca ESTE app como "Alto desempenho" (GPU dedicada em notebooks híbridos).
; Configuração por usuário (HKCU), visível e reversível no Windows, removida na desinstalação.
;
; Texturas HD do NFSU2 (pedido do Bruno, 06/11): página própria depois da pasta, com uma caixa para cada mod (TexWizard,
; Redux, Definitive Edition, NextGen), todas marcadas por padrão. O instalador copia resources\texturas\<mod>.pak e apaga os
; desmarcados; sem nenhum, apaga a pasta inteira (o app então roda sem texturas e desfaz a linha ui_textures que tinha
; gravado). Em Configurações > Texturas, o jogador escolhe de qual dos mods instalados vem cada parte.
; A escolha fica em HKCU\Software\NFS Launcher (TexTexwizard, TexRedux, TexDefinitive, TexNextgen = "1"/"0") e volta assim na
; próxima instalação (quem desmarcou tudo na versão de uma caixa só, TexturasHD = "0", começa com tudo desmarcado).
; Os textos ficam em português ou inglês, conforme o idioma do instalador.
!include nsDialogs.nsh
!include LogicLib.nsh

!define NFS_KEY "Software\NFS Launcher"

; Linha sem texturas (versão 2.x, pedido do Bruno, 06/11): instalador leve, sem a página e sem mexer na escolha guardada.
!searchparse /noerrors "v${VERSION}" "v" NFS_MAJOR "."
!if "${NFS_MAJOR}" == "2"
  !define NFS_LEVE
!endif

!ifndef BUILD_UNINSTALLER
!ifndef NFS_LEVE
  Var TexW ; "1" instala o TexWizard, "0" não
  Var TexR ; Redux
  Var TexD ; Definitive Edition
  Var TexN ; NextGen
  Var TexBoxW
  Var TexBoxR
  Var TexBoxD
  Var TexBoxN

  ; Lê a última escolha (antes de a versão antiga sair). Sem nada guardado: marcado.
  !macro texReadChoice VAR NAME
    ReadRegStr ${VAR} HKCU "${NFS_KEY}" "${NAME}"
    ${If} ${VAR} == ""
      ReadRegStr $0 HKCU "${NFS_KEY}" "TexturasHD"
      ${If} $0 == "0"
        StrCpy ${VAR} "0"
      ${EndIf}
    ${EndIf}
    ${If} ${VAR} != "0"
      StrCpy ${VAR} "1"
    ${EndIf}
  !macroend

  !macro customInit
    !insertmacro texReadChoice $TexW "TexTexwizard"
    !insertmacro texReadChoice $TexR "TexRedux"
    !insertmacro texReadChoice $TexD "TexDefinitive"
    !insertmacro texReadChoice $TexN "TexNextgen"
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
        ${NSD_CreateLabel} 0 0 100% 64u "Texturas melhores para as ruas, calçadas, prédios, árvores, céu e carros do NFSU2, de 4 mods da comunidade. Deixam o jogo mais bonito, mas pesam mais na placa de vídeo e deixam o primeiro carregamento mais lento. Depois, em Configurações > Texturas, você escolhe de qual mod vem cada parte (por exemplo, o asfalto de um e o céu de outro).$\r$\n$\r$\nEm PC com placa de vídeo integrada ou antiga (sem DirectX 12), deixe tudo desmarcado. Para mudar de ideia depois, é só instalar de novo."
        Pop $0
        ${NSD_CreateCheckbox} 0 70u 100% 12u "TexWizard: o visual do próprio jogo em alta resolução (cerca de 36 MB no disco)"
        Pop $TexBoxW
        ${NSD_CreateCheckbox} 0 84u 100% 12u "Redux (cerca de 390 MB)"
        Pop $TexBoxR
        ${NSD_CreateCheckbox} 0 98u 100% 12u "Definitive Edition (cerca de 325 MB)"
        Pop $TexBoxD
        ${NSD_CreateCheckbox} 0 112u 100% 12u "NextGen (cerca de 250 MB)"
        Pop $TexBoxN
      ${Else}
        !insertmacro MUI_HEADER_TEXT "HD textures" "Need for Speed: Underground 2"
        ${NSD_CreateLabel} 0 0 100% 64u "Better textures for the NFSU2 streets, sidewalks, buildings, trees, sky and cars, from 4 community mods. They make the game look better, but are heavier on the graphics card and make the first load slower. Later, in Settings > Textures, you choose which mod each part comes from (for example, the asphalt from one and the sky from another).$\r$\n$\r$\nOn a PC with integrated or old graphics (no DirectX 12), leave everything unchecked. To change your mind later, just install again."
        Pop $0
        ${NSD_CreateCheckbox} 0 70u 100% 12u "TexWizard: the game's own look in high resolution (about 36 MB on disk)"
        Pop $TexBoxW
        ${NSD_CreateCheckbox} 0 84u 100% 12u "Redux (about 390 MB)"
        Pop $TexBoxR
        ${NSD_CreateCheckbox} 0 98u 100% 12u "Definitive Edition (about 325 MB)"
        Pop $TexBoxD
        ${NSD_CreateCheckbox} 0 112u 100% 12u "NextGen (about 250 MB)"
        Pop $TexBoxN
      ${EndIf}
      ${If} $TexW == "1"
        ${NSD_Check} $TexBoxW
      ${EndIf}
      ${If} $TexR == "1"
        ${NSD_Check} $TexBoxR
      ${EndIf}
      ${If} $TexD == "1"
        ${NSD_Check} $TexBoxD
      ${EndIf}
      ${If} $TexN == "1"
        ${NSD_Check} $TexBoxN
      ${EndIf}
      nsDialogs::Show
    FunctionEnd

    Function TexPageLeave
      ${NSD_GetState} $TexBoxW $0
      ${If} $0 == ${BST_CHECKED}
        StrCpy $TexW "1"
      ${Else}
        StrCpy $TexW "0"
      ${EndIf}
      ${NSD_GetState} $TexBoxR $0
      ${If} $0 == ${BST_CHECKED}
        StrCpy $TexR "1"
      ${Else}
        StrCpy $TexR "0"
      ${EndIf}
      ${NSD_GetState} $TexBoxD $0
      ${If} $0 == ${BST_CHECKED}
        StrCpy $TexD "1"
      ${Else}
        StrCpy $TexD "0"
      ${EndIf}
      ${NSD_GetState} $TexBoxN $0
      ${If} $0 == ${BST_CHECKED}
        StrCpy $TexN "1"
      ${Else}
        StrCpy $TexN "0"
      ${EndIf}
    FunctionEnd
  !macroend
!endif
!endif

!macro customInstall
  WriteRegStr HKCU "Software\Microsoft\DirectX\UserGpuPreferences" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "GpuPreference=2;"
  !ifndef NFS_LEVE
  ${If} $TexW == "0"
    Delete "$INSTDIR\resources\texturas\texwizard.pak"
  ${EndIf}
  ${If} $TexR == "0"
    Delete "$INSTDIR\resources\texturas\redux.pak"
  ${EndIf}
  ${If} $TexD == "0"
    Delete "$INSTDIR\resources\texturas\definitive.pak"
  ${EndIf}
  ${If} $TexN == "0"
    Delete "$INSTDIR\resources\texturas\nextgen.pak"
  ${EndIf}
  ${If} $TexW == "0"
  ${AndIf} $TexR == "0"
  ${AndIf} $TexD == "0"
  ${AndIf} $TexN == "0"
    RMDir /r "$INSTDIR\resources\texturas"
  ${EndIf}
  WriteRegStr HKCU "${NFS_KEY}" "TexTexwizard" $TexW
  WriteRegStr HKCU "${NFS_KEY}" "TexRedux" $TexR
  WriteRegStr HKCU "${NFS_KEY}" "TexDefinitive" $TexD
  WriteRegStr HKCU "${NFS_KEY}" "TexNextgen" $TexN
  DeleteRegValue HKCU "${NFS_KEY}" "TexturasHD"
  !endif
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\DirectX\UserGpuPreferences" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  DeleteRegKey HKCU "${NFS_KEY}"
!macroend
