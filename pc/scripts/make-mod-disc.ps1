param([string]$Root = (Split-Path $PSScriptRoot -Parent))
# Disco do NFSU2 Modded (src/renderer/games/nfsu2mod.png): o disco do NFSU2 (feito por make-discs.ps1) com uma faixa
# "MODDED" laranja na parte de baixo, para não confundir os dois na tela inicial. Rodar depois do make-discs.ps1.
Add-Type -AssemblyName System.Drawing
$games = Join-Path $Root 'src\renderer\games'
$src = New-Object System.Drawing.Bitmap (Join-Path $games 'nfsu2.png')
$size = $src.Width
$b = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($b)
$g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'; $g.InterpolationMode = 'HighQualityBicubic'
$g.DrawImage($src, 0, 0, $size, $size); $src.Dispose()

$k = $size / 320.0
$w = [int](132 * $k); $h = [int](34 * $k); $x = [int](($size - $w) / 2); $y = [int](236 * $k); $r = [int](10 * $k)
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc($x, $y, 2 * $r, 2 * $r, 180, 90); $path.AddArc($x + $w - 2 * $r, $y, 2 * $r, 2 * $r, 270, 90)
$path.AddArc($x + $w - 2 * $r, $y + $h - 2 * $r, 2 * $r, 2 * $r, 0, 90); $path.AddArc($x, $y + $h - 2 * $r, 2 * $r, 2 * $r, 90, 90)
$path.CloseFigure()
$rect = New-Object System.Drawing.Rectangle $x, $y, $w, $h
$fill = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(255, 255, 150, 30)), ([System.Drawing.Color]::FromArgb(255, 220, 70, 0)), 90
$g.FillPath($fill, $path)
$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(230, 255, 255, 255)), ([single](2 * $k))
$g.DrawPath($pen, $path)

$font = New-Object System.Drawing.Font 'Arial Black', ([single](17 * $k)), ([System.Drawing.FontStyle]::Italic), ([System.Drawing.GraphicsUnit]::Pixel)
$fmt = New-Object System.Drawing.StringFormat; $fmt.Alignment = 'Center'; $fmt.LineAlignment = 'Center'
$rf = New-Object System.Drawing.RectangleF $x, ($y + 1 * $k), $w, $h
$shadow = New-Object System.Drawing.RectangleF ($x + 1.5 * $k), ($y + 2.5 * $k), $w, $h
$g.DrawString('MODDED', $font, (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(160, 60, 15, 0))), $shadow, $fmt)
$g.DrawString('MODDED', $font, [System.Drawing.Brushes]::White, $rf, $fmt)
$g.Dispose()
$b.Save((Join-Path $games 'nfsu2mod.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$b.Dispose()
