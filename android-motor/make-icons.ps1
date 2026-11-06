# Gera os ícones do NFS Motor (colagem dos CDs, build/icon.png) nos tamanhos do Android.
# Saída: android-motor/res/mipmap-<densidade>/ — o build.sh copia por cima dos ícones do Chromium.
#   app_icon.png                  ícone comum (48 dp)
#   layered_app_icon.png          frente do ícone adaptável (108 dp; o desenho fica no círculo seguro de 66 dp)
#   layered_app_icon_background.png  fundo do ícone adaptável (azul-escuro do app)
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$src = [System.Drawing.Image]::FromFile((Join-Path $root 'build\icon.png'))
$bg = [System.Drawing.Color]::FromArgb(255, 11, 13, 23)   # #0B0D17
$dens = [ordered]@{ mdpi = 1.0; hdpi = 1.5; xhdpi = 2.0; xxhdpi = 3.0; xxxhdpi = 4.0 }

function Save-Png($size, $draw, $path) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  & $draw $g $size
  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

foreach ($d in $dens.Keys) {
  $k = $dens[$d]
  $dir = Join-Path $PSScriptRoot "res\mipmap-$d"
  New-Item -ItemType Directory -Force $dir | Out-Null
  $s48 = [int](48 * $k); $s108 = [int](108 * $k)
  Save-Png $s48 { param($g, $s) $g.DrawImage($src, 0, 0, $s, $s) } (Join-Path $dir 'app_icon.png')
  Save-Png $s108 { param($g, $s) $in = [int]($s * 66 / 108); $o = [int](($s - $in) / 2); $g.DrawImage($src, $o, $o, $in, $in) } (Join-Path $dir 'layered_app_icon.png')
  Save-Png $s108 { param($g, $s) $g.Clear($bg) } (Join-Path $dir 'layered_app_icon_background.png')
}
$src.Dispose()
Get-ChildItem -Recurse (Join-Path $PSScriptRoot 'res') -File | ForEach-Object { $_.FullName.Substring($root.Length + 1) }
