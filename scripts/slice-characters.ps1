# Slices the character sheets in "designs + characters" into game-ready assets.
#
# Every sheet is 896x1200: a 4-view turnaround on top, a row of four expression
# heads below, sometimes a text label row under that. Nothing is hardcoded -
# the background colour is read from a corner pixel, then rows and columns that
# are almost entirely background are used to find the bands and the individual
# figures. That is what makes this work across sheets whose layouts differ.
#
# Run:  powershell -ExecutionPolicy Bypass -File scripts/slice-characters.ps1

param(
  [string]$SourceDir = "D:\My Apps\ideas\designs + characters",
  [string]$OutDir = "$PSScriptRoot\..\public\characters"
)

Add-Type -AssemblyName System.Drawing

$MAP = [ordered]@{
  'Dr.Yaman (Dentist).png' = 'yaman'
  'Dr.Miya(Dentist).png'   = 'miya'
  'Dr.Amr.png'             = 'amr'
  'Dr.Tala.png'            = 'tala'
  'hf_20260723_093337_fefe6aba-956d-4405-a5a8-11d2be693222.png' = 'patient-1'
  'hf_20260723_093536_30ce6b00-75c5-42ea-8f67-6ab1c435d56b.png' = 'patient-2'
  'hf_20260723_094642_fec40012-85bc-4921-94b8-b5c1844205c9.png' = 'patient-3'
  'hf_20260723_095458_226e7a5a-c46b-4e39-8e76-7b6c5eccfe18.png' = 'patient-4'
  'hf_20260723_095911_6b65861c-64b3-4fd3-ade5-7ac324d03590.png' = 'patient-5'
  'hf_20260723_101842_20fd9e97-3dbe-4bbd-bcaf-4cb1e4b6bc3e.png' = 'patient-6'
  'hf_20260723_102555_af711834-ef86-47c6-a940-7de7a9b58622.png' = 'patient-7'
  'hf_20260723_103021_ca3f0eb3-9fa2-4508-8720-a6445e35a1e2.png' = 'patient-8'
}
$SCENES = [ordered]@{ 'Dental clinic.png' = 'scene-dental'; 'Medical Clinic.png' = 'scene-medical' }

# Left-to-right order on every sheet, per CHARACTER_SHEETS.md.
$EXPRESSIONS = @('calm', 'anxious', 'pain', 'relieved')

# Two sheets use bespoke layouts that no sane heuristic recovers: patient-5 has
# a hero figure with three boxed heads on the right (its "calm" is the hero's
# own face), and patient-8 stacks four heads in a right-hand column. Their crop
# boxes are pinned here as fractions of the sheet, measured off the artwork.
# Rects are @(x, y, w, h) in 0..1; heads are squared off their width.
$OVERRIDES = @{
  # 2x2 body grid on the left, heads stacked in a column on the right.
  'patient-4' = @{
    heads = @(@(0.744, 0.052, 0.22, 0.175), @(0.744, 0.291, 0.22, 0.175),
              @(0.744, 0.550, 0.22, 0.175), @(0.744, 0.779, 0.22, 0.175))
    body  = @(0.055, 0.02, 0.35, 0.48)
  }
  'patient-5' = @{
    heads = @(@(0.205, 0.272, 0.26, 0.20), @(0.719, 0.281, 0.263, 0.198),
              @(0.719, 0.511, 0.263, 0.198), @(0.719, 0.744, 0.263, 0.198))
    body  = @(0.03, 0.27, 0.64, 0.70)
  }
  'patient-8' = @{
    # Same centres, tighter box - these sheets caption each head underneath.
    heads = @(@(0.680, 0.040, 0.26, 0.19), @(0.680, 0.280, 0.26, 0.19),
              @(0.680, 0.515, 0.26, 0.19), @(0.680, 0.750, 0.26, 0.19))
    body  = @(0.12, 0.04, 0.45, 0.93)
  }
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq 'image/jpeg' }

function Save-Crop($src, [int]$x, [int]$y, [int]$cw, [int]$ch, [int]$outW, [int]$outH, [string]$path) {
  if ($x -lt 0) { $cw += $x; $x = 0 }
  if ($y -lt 0) { $ch += $y; $y = 0 }
  if ($x + $cw -gt $src.Width) { $cw = $src.Width - $x }
  if ($y + $ch -gt $src.Height) { $ch = $src.Height - $y }
  if ($cw -lt 8 -or $ch -lt 8) { return $false }
  $dst = New-Object System.Drawing.Bitmap $outW, $outH
  $gfx = [System.Drawing.Graphics]::FromImage($dst)
  $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $gfx.DrawImage($src,
    (New-Object System.Drawing.Rectangle 0, 0, $outW, $outH),
    (New-Object System.Drawing.Rectangle $x, $y, $cw, $ch),
    [System.Drawing.GraphicsUnit]::Pixel)
  $gfx.Dispose()
  $prm = New-Object System.Drawing.Imaging.EncoderParameters 1
  $prm.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
    [System.Drawing.Imaging.Encoder]::Quality, 86)
  $dst.Save($path, $jpegCodec, $prm)
  $dst.Dispose()
  return $true
}

# Contiguous runs above a threshold. Returns [start,end] pairs as int arrays.
function Find-Runs([double[]]$vals, [double]$thresh, [int]$minGap, [int]$minSize) {
  $out = New-Object System.Collections.ArrayList
  $n = [int]$vals.Length
  $s = -1
  $g = 0
  for ($i = 0; $i -lt $n; $i++) {
    if ($vals[$i] -gt $thresh) {
      if ($s -lt 0) { $s = $i }
      $g = 0
    } elseif ($s -ge 0) {
      $g++
      if ($g -ge $minGap) {
        $e = $i - $g
        if (($e - $s) -ge $minSize) { [void]$out.Add(@([int]$s, [int]$e)) }
        $s = -1; $g = 0
      }
    }
  }
  if ($s -ge 0) {
    $e = $n - 1
    if (($e - $s) -ge $minSize) { [void]$out.Add(@([int]$s, [int]$e)) }
  }
  # The leading comma is load-bearing: PowerShell unrolls a returned collection,
  # so a single band would come back as a bare [start,end] pair and every
  # caller's indexing would silently mean something else.
  return , $out.ToArray()
}

$total = 0
$failed = @()

foreach ($entry in $MAP.GetEnumerator()) {
  $file = Join-Path $SourceDir $entry.Key
  if (-not (Test-Path $file)) { Write-Warning "missing: $($entry.Key)"; continue }
  $slug = $entry.Value

  $bmp = [System.Drawing.Bitmap]::FromFile($file)
  $iw = [int]$bmp.Width
  $ih = [int]$bmp.Height

  if ($OVERRIDES.ContainsKey($slug)) {
    $ov = $OVERRIDES[$slug]
    $made = 0
    for ($i = 0; $i -lt 4; $i++) {
      $r = $ov.heads[$i]
      $px = [int]($r[0] * $iw); $py = [int]($r[1] * $ih)
      $pw = [int]($r[2] * $iw); $ph = [int]($r[3] * $ih)
      $size = [Math]::Max($pw, $ph)
      $cx = $px + [int]($pw / 2); $cy = $py + [int]($ph / 2)
      if (Save-Crop $bmp ($cx - [int]($size / 2)) ($cy - [int]($size / 2)) $size $size `
          256 256 (Join-Path $OutDir "$slug-$($EXPRESSIONS[$i]).jpg")) { $total++; $made++ }
    }
    $r = $ov.body
    $bw2 = [int]($r[2] * $iw); $bh2 = [int]($r[3] * $ih)
    if (Save-Crop $bmp ([int]($r[0] * $iw)) ([int]($r[1] * $ih)) $bw2 $bh2 `
        320 ([int](320.0 * $bh2 / $bw2)) (Join-Path $OutDir "$slug-body.jpg")) { $total++ }
    Write-Host ("{0,-11} pinned layout   portraits={1}" -f $slug, $made)
    if ($made -lt 4) { $failed += $slug }
    $bmp.Dispose(); continue
  }

  $rect = New-Object System.Drawing.Rectangle 0, 0, $iw, $ih
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $stride = [int]$data.Stride
  $bytes = New-Object byte[] ($stride * $ih)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
  $bmp.UnlockBits($data)

  # Background is whatever fills the corners - read it rather than assume grey.
  $bgB = [int]$bytes[0]; $bgG = [int]$bytes[1]; $bgR = [int]$bytes[2]
  $tol = 26

  # Ink mask, subsampled 2x2 for speed.
  $sw = [int][Math]::Floor($iw / 2)
  $sh = [int][Math]::Floor($ih / 2)
  $mask = New-Object 'byte[]' ($sw * $sh)
  for ($sy = 0; $sy -lt $sh; $sy++) {
    $base = ($sy * 2) * $stride
    $row = $sy * $sw
    for ($sx = 0; $sx -lt $sw; $sx++) {
      $i = $base + ($sx * 2) * 4
      $d = [Math]::Abs([int]$bytes[$i] - $bgB)
      $d2 = [Math]::Abs([int]$bytes[$i + 1] - $bgG); if ($d2 -gt $d) { $d = $d2 }
      $d2 = [Math]::Abs([int]$bytes[$i + 2] - $bgR); if ($d2 -gt $d) { $d = $d2 }
      if ($d -gt $tol) { $mask[$row + $sx] = 1 }
    }
  }

  # Row bands -> body row, head row, (optional) label row.
  $rowInk = New-Object double[] $sh
  for ($sy = 0; $sy -lt $sh; $sy++) {
    $row = $sy * $sw; $n = 0
    for ($sx = 0; $sx -lt $sw; $sx++) { if ($mask[$row + $sx]) { $n++ } }
    $rowInk[$sy] = $n / $sw
  }
  $bands = Find-Runs $rowInk 0.01 8 20

  # Column clusters inside a row band -> the individual figures.
  function Get-Figures($band, [int]$xFrom, [int]$xTo) {
    $colInk = New-Object double[] $sw
    $rows = $band[1] - $band[0] + 1
    for ($sx = $xFrom; $sx -le $xTo; $sx++) {
      $n = 0
      for ($sy = $band[0]; $sy -le $band[1]; $sy++) { if ($mask[$sy * $sw + $sx]) { $n++ } }
      $colInk[$sx] = $n / $rows
    }
    return Find-Runs $colInk 0.02 5 12
  }

  # Three sheet formats exist in this set:
  #   A. four views + a head row      (bands: bodies, heads[, labels])
  #   B. a title, one body, head row  (bands: title, body, heads, labels)
  #   C. one body left, heads stacked vertically on the right (a single band)
  # Rather than assume band order, take the TALLEST band as the body - a figure
  # is always the tallest thing on the sheet - and the first band below it that
  # is big enough to be heads rather than a text label.
  $vertical = $false
  if ($bands.Count -lt 2) { $vertical = $true }

  if (-not $vertical) {
    $bi = 0
    for ($k = 1; $k -lt $bands.Count; $k++) {
      if (($bands[$k][1] - $bands[$k][0]) -gt ($bands[$bi][1] - $bands[$bi][0])) { $bi = $k }
    }
    $bodyBand = $bands[$bi]
    $headBand = $null
    for ($k = $bi + 1; $k -lt $bands.Count; $k++) {
      if (($bands[$k][1] - $bands[$k][0]) -ge 40) { $headBand = $bands[$k]; break }
    }
    if ($null -eq $headBand) { $vertical = $true }
  }

  if ($vertical) {
    # Format C: split left/right, heads are stacked in the right-hand column.
    $full = @(0, $sh - 1)
    $cols = Get-Figures $full 0 ($sw - 1)
    if ($cols.Count -lt 2) {
      Write-Warning "$slug : unrecognised layout - skipped"
      $failed += $slug; $bmp.Dispose(); continue
    }
    $bodyCol = $cols[0]
    $headCol = $cols[$cols.Count - 1]

    $rowInk2 = New-Object double[] $sh
    $wid = $headCol[1] - $headCol[0] + 1
    for ($sy = 0; $sy -lt $sh; $sy++) {
      $n = 0
      for ($sx = $headCol[0]; $sx -le $headCol[1]; $sx++) { if ($mask[$sy * $sw + $sx]) { $n++ } }
      $rowInk2[$sy] = $n / $wid
    }
    $headRows = Find-Runs $rowInk2 0.04 5 25

    $made = 0
    for ($i = 0; $i -lt [Math]::Min(4, $headRows.Count); $i++) {
      $r = $headRows[$i]
      $y0 = [int]($r[0] * 2); $y1 = [int]($r[1] * 2)
      $x0 = [int]($headCol[0] * 2); $x1 = [int]($headCol[1] * 2)
      $size = [int]([Math]::Max($x1 - $x0, $y1 - $y0) * 1.02)
      $cx = [int](($x0 + $x1) / 2); $cy = [int](($y0 + $y1) / 2)
      if (Save-Crop $bmp ($cx - [int]($size / 2)) ($cy - [int]($size / 2)) $size $size `
          256 256 (Join-Path $OutDir "$slug-$($EXPRESSIONS[$i]).jpg")) { $total++; $made++ }
    }
    $bx0 = [int]($bodyCol[0] * 2); $bx1 = [int]($bodyCol[1] * 2)
    $bodyRows = Find-Runs (@(0..($sh - 1) | ForEach-Object {
      $n = 0
      for ($sx = $bodyCol[0]; $sx -le $bodyCol[1]; $sx++) { if ($mask[$_ * $sw + $sx]) { $n++ } }
      $n / ($bodyCol[1] - $bodyCol[0] + 1)
    })) 0.02 10 40
    if ($bodyRows.Count -ge 1) {
      $by0 = [int]($bodyRows[0][0] * 2); $by1 = [int]($bodyRows[$bodyRows.Count - 1][1] * 2)
      $pad = [int](($bx1 - $bx0) * 0.12)
      $cw2 = ($bx1 - $bx0) + $pad * 2
      $ch2 = $by1 - $by0
      if (Save-Crop $bmp ($bx0 - $pad) $by0 $cw2 $ch2 320 ([int](320.0 * $ch2 / $cw2)) `
          (Join-Path $OutDir "$slug-body.jpg")) { $total++ }
    }
    Write-Host ("{0,-11} vertical layout  portraits={1}" -f $slug, $made)
    if ($made -lt 4) { $failed += "$slug (only $made portraits)" }
    $bmp.Dispose(); continue
  }

  $heads = Get-Figures $headBand 0 ($sw - 1)
  $bodies = Get-Figures $bodyBand 0 ($sw - 1)

  # Adjacent figures sometimes touch and merge into one cluster. They are always
  # evenly spaced, so fall back to splitting the row's full extent into quarters.
  function Split-Even($clusters) {
    if ($clusters.Count -eq 0) { return $clusters }
    $lo = [int]$clusters[0][0]
    $hi = [int]$clusters[$clusters.Count - 1][1]
    $span = ($hi - $lo) / 4.0
    $out = New-Object System.Collections.ArrayList
    for ($k = 0; $k -lt 4; $k++) {
      $a = [int]($lo + $span * $k)
      $b = [int]($lo + $span * ($k + 1))
      [void]$out.Add(@($a, $b))
    }
    return , $out.ToArray()
  }
  if ($heads.Count -ne 4) { $heads = Split-Even $heads }
  # A single body cluster means a one-figure sheet (format B) - splitting that
  # into quarters would crop a sliver of the character instead of the whole one.
  if ($bodies.Count -ne 4 -and $bodies.Count -ne 1) { $bodies = Split-Even $bodies }

  # Portraits: square crop around each head's own bounding box.
  $made = 0
  for ($i = 0; $i -lt [Math]::Min(4, $heads.Count); $i++) {
    $c = $heads[$i]
    # Tighten vertically to this head's own rows (labels sit below and are
    # excluded because the band already ended before them).
    $x0 = [int]($c[0] * 2); $x1 = [int]($c[1] * 2)
    $y0 = [int]($headBand[0] * 2); $y1 = [int]($headBand[1] * 2)
    $cw = $x1 - $x0; $chh = $y1 - $y0
    # Snug to the head's own width so the neighbouring head never bleeds in.
    $size = [int]($cw * 1.02)
    $cx = [int](($x0 + $x1) / 2)
    $cy = [int]($y0 + $chh * 0.44)
    if (Save-Crop $bmp ($cx - [int]($size / 2)) ($cy - [int]($size / 2)) $size $size `
        256 256 (Join-Path $OutDir "$slug-$($EXPRESSIONS[$i]).jpg")) { $total++; $made++ }
  }

  # Front-facing full body: the first figure of the top band.
  if ($bodies.Count -ge 1) {
    $c = $bodies[0]
    $x0 = [int]($c[0] * 2); $x1 = [int]($c[1] * 2)
    $y0 = [int]($bodyBand[0] * 2); $y1 = [int]($bodyBand[1] * 2)
    $pad = [int](($x1 - $x0) * 0.14)
    $cw = ($x1 - $x0) + $pad * 2
    $chh = $y1 - $y0
    if (Save-Crop $bmp ($x0 - $pad) $y0 $cw $chh 320 ([int](320.0 * $chh / $cw)) `
        (Join-Path $OutDir "$slug-body.jpg")) { $total++ }
  }

  Write-Host ("{0,-11} heads={1} bodies={2} portraits={3}" -f $slug, $heads.Count, $bodies.Count, $made)
  if ($made -lt 4) { $failed += "$slug (only $made portraits)" }
  $bmp.Dispose()
}

foreach ($entry in $SCENES.GetEnumerator()) {
  $file = Join-Path $SourceDir $entry.Key
  if (-not (Test-Path $file)) { continue }
  $bmp = [System.Drawing.Bitmap]::FromFile($file)
  [void](Save-Crop $bmp 0 0 $bmp.Width $bmp.Height 720 ([int](720.0 * $bmp.Height / $bmp.Width)) `
    (Join-Path $OutDir "$($entry.Value).jpg"))
  $bmp.Dispose(); $total++
}

Write-Host "`nwrote $total files"
if ($failed.Count) { Write-Host "NEEDS ATTENTION: $($failed -join ', ')" }
