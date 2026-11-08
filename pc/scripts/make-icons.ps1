param([string]$Root)
# Gera os ícones do app a partir de iconenovo.png (quadrado, fundo transparente):
# build/icon.png e src/renderer/icon.png (512 px) e build/icon.ico (16–256 px, entradas PNG).
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile((Join-Path $Root 'arte\iconenovo.png'))
$side = [Math]::Max($src.Width, $src.Height)

function Render([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $scale = $size / $side
  $w = $src.Width * $scale; $h = $src.Height * $scale
  $g.DrawImage($src, [single](($size - $w) / 2), [single](($size - $h) / 2), [single]$w, [single]$h)
  $g.Dispose()
  return $bmp
}
function PngBytes($bmp) { $ms = New-Object System.IO.MemoryStream; $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png); return ,$ms.ToArray() }

$big = Render 512
$bytes = PngBytes $big
[IO.File]::WriteAllBytes((Join-Path $Root 'build\icon.png'), $bytes)
[IO.File]::WriteAllBytes((Join-Path $Root 'src\renderer\icon.png'), $bytes)
$big.Dispose()

$sizes = 16, 24, 32, 48, 64, 128, 256
$imgs = foreach ($s in $sizes) { $b = Render $s; ,(PngBytes $b); $b.Dispose() }
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter $ms
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $s = $sizes[$i]; $d = $imgs[$i]
  $bw.Write([byte]($(if ($s -ge 256) { 0 } else { $s }))); $bw.Write([byte]($(if ($s -ge 256) { 0 } else { $s })))
  $bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([UInt16]1); $bw.Write([UInt16]32)
  $bw.Write([UInt32]$d.Length); $bw.Write([UInt32]$offset); $offset += $d.Length
}
foreach ($d in $imgs) { $bw.Write($d) }
$bw.Flush()
[IO.File]::WriteAllBytes((Join-Path $Root 'build\icon.ico'), $ms.ToArray())
$src.Dispose()
"ok"
