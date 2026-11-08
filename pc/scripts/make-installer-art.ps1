# Gera as imagens do instalador (build\installerSidebar.bmp, uninstallerSidebar.bmp, installerHeader.bmp)
# a partir do fundo do NFSU2 e do icone do app. Uso: powershell -File scripts\make-installer-art.ps1
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$bg = [System.Drawing.Image]::FromFile((Join-Path $root 'src\renderer\bg\nfsu2.jpg'))
$icon = [System.Drawing.Image]::FromFile((Join-Path $root 'build\icon.png'))
$neon = [System.Drawing.Color]::FromArgb(0, 255, 200)

function New-Canvas($w, $h) {
  $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  # Recorte do meio da imagem de fundo, na proporção da tela de destino.
  $scale = [Math]::Max($w / $bg.Width, $h / $bg.Height)
  $sw = $w / $scale; $sh = $h / $scale
  $src = New-Object System.Drawing.RectangleF((($bg.Width - $sw) / 2), (($bg.Height - $sh) / 2), $sw, $sh)
  $dst = New-Object System.Drawing.RectangleF(0, 0, $w, $h)
  $g.DrawImage($bg, $dst, $src, [System.Drawing.GraphicsUnit]::Pixel)
  $shade = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(150, 6, 8, 18))
  $g.FillRectangle($shade, 0, 0, $w, $h)
  $shade.Dispose()
  return @{ bmp = $bmp; g = $g }
}
function Draw-Name($g, $x, $y, $size) {
  $bold = New-Object System.Drawing.Font('Segoe UI', $size, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $green = New-Object System.Drawing.SolidBrush($neon)
  $g.DrawString('NFS', $bold, $white, [single]$x, [single]$y)
  $g.DrawString('Launcher', $bold, $green, [single]$x, [single]($y + $size * 1.15))
  $bold.Dispose(); $white.Dispose(); $green.Dispose()
}
function Save-Bmp($c, $name) {
  $c.g.Dispose()
  $c.bmp.Save((Join-Path $root "build\$name"), [System.Drawing.Imaging.ImageFormat]::Bmp)
  $c.bmp.Dispose()
}

foreach ($name in 'installerSidebar.bmp', 'uninstallerSidebar.bmp') {
  $c = New-Canvas 164 314
  $c.g.DrawImage($icon, 22, 40, 120, 120)
  Draw-Name $c.g 22 180 26
  Save-Bmp $c $name
}

$c = New-Canvas 150 57
$c.g.DrawImage($icon, 6, 8, 41, 41)
Draw-Name $c.g 52 9 17
Save-Bmp $c 'installerHeader.bmp'

$bg.Dispose(); $icon.Dispose()
