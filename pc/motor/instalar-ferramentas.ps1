# Instala o que o Chromium 156 exige para compilar no Windows: Visual Studio 2026 (C++ e ATL/MFC) e Windows SDK 10.0.28000.
# Roda uma vez, como administrador. Nao mexe em mais nada do sistema.
New-Item -ItemType Directory -Force 'C:\e' | Out-Null
Start-Transcript -Path 'C:\e\instalar.log' -Append | Out-Null

winget install --id Microsoft.WindowsSDK.10.0.28000 --source winget --silent --accept-package-agreements --accept-source-agreements --disable-interactivity
"SDK: codigo $LASTEXITCODE"

$vs = '--passive --wait --norestart --add Microsoft.VisualStudio.Workload.NativeDesktop --add Microsoft.VisualStudio.Component.VC.ATLMFC --includeRecommended'
winget install --id Microsoft.VisualStudio.Community --source winget --override $vs --accept-package-agreements --accept-source-agreements --disable-interactivity
"Visual Studio: codigo $LASTEXITCODE"

"FIM"
Stop-Transcript | Out-Null
