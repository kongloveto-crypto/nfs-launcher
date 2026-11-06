param([string]$Root)
# Discos do catálogo (src/renderer/games/<id>.png, 320 px) e ícone do app = colagem dos três CDs
# (build/icon.ico 16–256 px, build/icon.png e src/renderer/icon.png 512 px).
# Entradas na raiz do projeto: iconenovo.png (NFSU2, fundo transparente), mostwanted.png (NFSMW, fundo branco) e
# "nfs carbon.jpg" (NFSC, fundo branco).
# Cada CD vira um CÍRCULO PERFEITO e centralizado: acha o contorno do disco (ignorando sobras do fundo), estica o
# recorte para quadrado (a foto do NFSU2 é um pouco oval) e apaga tudo fora do círculo e o furo do meio.
# Assim o anel neon da tela inicial (border-radius 50%) encaixa certinho e o CD gira sem "balançar".
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.Drawing; using System.Drawing.Drawing2D; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class Disc {
  static byte[] Pixels(Bitmap b, out int stride) {
    var d = b.LockBits(new Rectangle(0, 0, b.Width, b.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    stride = d.Stride; var px = new byte[d.Stride * b.Height]; Marshal.Copy(d.Scan0, px, 0, px.Length); b.UnlockBits(d); return px;
  }
  public static Bitmap Normalize(Bitmap srcAny, bool whiteBg, int size) {
    var src = new Bitmap(srcAny.Width, srcAny.Height, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(src)) g.DrawImage(srcAny, 0, 0, srcAny.Width, srcAny.Height);
    int w = src.Width, h = src.Height, stride; var px = Pixels(src, out stride);
    Func<int,bool> isBg = (i) => px[i+3] < 40 || (whiteBg && px[i] > 228 && px[i+1] > 228 && px[i+2] > 228);
    var cols = new int[w]; var rows = new int[h];
    for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) if (!isBg(y * stride + x * 4)) { cols[x]++; rows[y]++; }
    // Linha/coluna só conta como disco com 2% de pixels de disco: descarta sombras e sujeira do fundo.
    int tx = (int)(h * 0.02), ty = (int)(w * 0.02), minX = 0, maxX = w - 1, minY = 0, maxY = h - 1;
    while (cols[minX] <= tx) minX++; while (cols[maxX] <= tx) maxX--; while (rows[minY] <= ty) minY++; while (rows[maxY] <= ty) maxY--;
    var outB = new Bitmap(size, size, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(outB)) {
      g.Clear(Color.Transparent); g.InterpolationMode = InterpolationMode.HighQualityBicubic; g.PixelOffsetMode = PixelOffsetMode.HighQuality;
      g.DrawImage(src, new Rectangle(0, 0, size, size), new Rectangle(minX, minY, maxX - minX + 1, maxY - minY + 1), GraphicsUnit.Pixel);
    }
    src.Dispose();
    var d = outB.LockBits(new Rectangle(0, 0, size, size), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    var o = new byte[d.Stride * size]; Marshal.Copy(d.Scan0, o, 0, o.Length);
    double c = size / 2.0, R = size / 2.0 - 0.5, hole = R * 0.17;
    for (int y = 0; y < size; y++) for (int x = 0; x < size; x++) {
      int i = y * d.Stride + x * 4; double dist = Math.Sqrt((x + 0.5 - c) * (x + 0.5 - c) + (y + 0.5 - c) * (y + 0.5 - c));
      double a = Math.Max(0, Math.Min(1, R - dist + 0.5));                                   // borda externa lisa
      if (whiteBg && dist < hole && o[i] > 200 && o[i+1] > 200 && o[i+2] > 200) a = 0;        // furo do meio (foto)
      o[i + 3] = (byte)(o[i + 3] * a);
    }
    Marshal.Copy(o, 0, d.Scan0, o.Length); outB.UnlockBits(d);
    return outB;
  }
}
'@

function Png($bmp, $path) { $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png) }
function PngBytes($bmp) { $ms = New-Object System.IO.MemoryStream; $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png); return ,$ms.ToArray() }

$s = New-Object System.Drawing.Bitmap (Join-Path $Root 'iconenovo.png'); $u2 = [Disc]::Normalize($s, $false, 1024); $s.Dispose()
$s = New-Object System.Drawing.Bitmap (Join-Path $Root 'mostwanted.png'); $mw = [Disc]::Normalize($s, $true, 1024); $s.Dispose()

function Scaled($img, [int]$size) {
  $b = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($b); $g.Clear([System.Drawing.Color]::Transparent)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'; $g.SmoothingMode = 'HighQuality'
  $g.DrawImage($img, 0, 0, $size, $size); $g.Dispose(); return $b
}
$games = Join-Path $Root 'src\renderer\games'
New-Item -ItemType Directory -Force $games | Out-Null
$b = Scaled $u2 320; Png $b (Join-Path $games 'nfsu2.png'); $b.Dispose()
$b = Scaled $mw 320; Png $b (Join-Path $games 'nfsmw.png'); $b.Dispose()
# Carbon (foto do CD em fundo branco).
$s = New-Object System.Drawing.Bitmap (Join-Path $Root 'nfs carbon.jpg'); $nc = [Disc]::Normalize($s, $true, 1024); $s.Dispose()
$b = Scaled $nc 320; Png $b (Join-Path $games 'nfsc.png'); $b.Dispose()

# Colagem dos 3 CDs espalhados, como capas jogadas na mesa (pedido do Bruno, 05/11): NFSU2 atrás (em cima, à esquerda),
# NFSMW no meio (à direita), Carbon na frente (embaixo, ao centro). Cada um cobre só a parte de baixo do anterior,
# para o nome de todos aparecer; sombra leve sob os de cima.
function Shadow($g, [single]$x, [single]$y, [single]$d, [int]$size) {
  $sh = New-Object System.Drawing.Drawing2D.GraphicsPath
  $sh.AddEllipse([single]($x - $size * 0.01), [single]($y + $size * 0.014), $d, $d)
  $brush = New-Object System.Drawing.Drawing2D.PathGradientBrush $sh
  $brush.CenterColor = [System.Drawing.Color]::FromArgb(150, 0, 0, 0); $brush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
  $g.FillPath($brush, $sh); $brush.Dispose(); $sh.Dispose()
}
function Collage([int]$size) {
  $b = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($b); $g.Clear([System.Drawing.Color]::Transparent)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'; $g.SmoothingMode = 'HighQuality'; $g.CompositingQuality = 'HighQuality'
  $d = [single]($size * 0.60); $r = [single]($size - $d)
  $g.DrawImage($u2, [single]0, [single]0, $d, $d)
  Shadow $g $r ([single]($r * 0.45)) $d $size
  $g.DrawImage($mw, $r, [single]($r * 0.45), $d, $d)
  Shadow $g ([single]($r * 0.4)) $r $d $size
  $g.DrawImage($nc, [single]($r * 0.4), $r, $d, $d)
  $g.Dispose(); return $b
}
$big = Collage 512
Png $big (Join-Path $Root 'build\icon.png'); Png $big (Join-Path $Root 'src\renderer\icon.png'); $big.Dispose()

$sizes = 16, 24, 32, 48, 64, 128, 256
$imgs = foreach ($sz in $sizes) { $c = Collage $sz; ,(PngBytes $c); $c.Dispose() }
$ms = New-Object System.IO.MemoryStream; $bw = New-Object System.IO.BinaryWriter $ms
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $sz = $sizes[$i]; $dd = $imgs[$i]; $e = $(if ($sz -ge 256) { 0 } else { $sz })
  $bw.Write([byte]$e); $bw.Write([byte]$e); $bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([UInt16]1); $bw.Write([UInt16]32)
  $bw.Write([UInt32]$dd.Length); $bw.Write([UInt32]$offset); $offset += $dd.Length
}
foreach ($dd in $imgs) { $bw.Write($dd) }
$bw.Flush(); [IO.File]::WriteAllBytes((Join-Path $Root 'build\icon.ico'), $ms.ToArray())
$u2.Dispose(); $mw.Dispose(); $nc.Dispose()
'ok'
