param(
  [string]$AssetDir = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
if (-not $AssetDir) {
  $AssetDir = Join-Path $repoRoot "web\assets"
}
New-Item -ItemType Directory -Force -Path $AssetDir | Out-Null

function Get-JpegCodec {
  [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
}

function New-EncoderParams([int64]$Quality) {
  $params = New-Object System.Drawing.Imaging.EncoderParameters 1
  $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), $Quality
  return $params
}

function Save-Jpeg(
  [string]$Url,
  [string]$Name,
  [int]$TargetWidth,
  [int]$TargetHeight,
  [int64]$Quality,
  [switch]$Contain,
  [string]$Background = "#edf7fb"
) {
  $tmp = [System.IO.Path]::GetTempFileName()
  Invoke-WebRequest -Uri $Url -OutFile $tmp -UseBasicParsing -Headers @{ "User-Agent" = "Codex asset builder" }
  $src = $null
  $bmp = $null
  $gfx = $null
  $enc = $null
  try {
    $src = [System.Drawing.Image]::FromFile($tmp)
    $bmp = New-Object System.Drawing.Bitmap $TargetWidth, $TargetHeight
    $gfx = [System.Drawing.Graphics]::FromImage($bmp)
    $enc = New-EncoderParams $Quality

    $gfx.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $gfx.Clear([System.Drawing.ColorTranslator]::FromHtml($Background))

    if ($Contain) {
      $scale = [Math]::Min($TargetWidth / $src.Width, $TargetHeight / $src.Height)
      $drawW = [int]($src.Width * $scale)
      $drawH = [int]($src.Height * $scale)
      $drawX = [int](($TargetWidth - $drawW) / 2)
      $drawY = [int](($TargetHeight - $drawH) / 2)
      $dest = New-Object System.Drawing.Rectangle $drawX, $drawY, $drawW, $drawH
      $gfx.DrawImage($src, $dest)
    } else {
      $targetRatio = $TargetWidth / $TargetHeight
      $sourceRatio = $src.Width / $src.Height
      if ($sourceRatio -gt $targetRatio) {
        $cropH = $src.Height
        $cropW = [int]($src.Height * $targetRatio)
        $cropX = [int](($src.Width - $cropW) / 2)
        $cropY = 0
      } else {
        $cropW = $src.Width
        $cropH = [int]($src.Width / $targetRatio)
        $cropX = 0
        $cropY = [int](($src.Height - $cropH) / 2)
      }
      $dest = New-Object System.Drawing.Rectangle 0, 0, $TargetWidth, $TargetHeight
      $crop = New-Object System.Drawing.Rectangle $cropX, $cropY, $cropW, $cropH
      $gfx.DrawImage($src, $dest, $crop, [System.Drawing.GraphicsUnit]::Pixel)
    }

    $outPath = Join-Path $AssetDir $Name
    $bmp.Save($outPath, (Get-JpegCodec), $enc)
  } finally {
    if ($enc) { $enc.Dispose() }
    if ($gfx) { $gfx.Dispose() }
    if ($bmp) { $bmp.Dispose() }
    if ($src) { $src.Dispose() }
    Remove-Item $tmp -Force
  }
}

Save-Jpeg `
  "https://upload-static.hoyoverse.com/hk4e/upload/fb/common.jpg" `
  "hero-bg.jpg" 1280 560 72 -Background "#1a2732"

Save-Jpeg `
  "https://static.wikia.nocookie.net/gensin-impact/images/0/0e/Character_Ganyu_Full_Wish.png/revision/latest?cb=20220713045854&format=original" `
  "ganyu-art.jpg" 520 470 78 -Contain -Background "#eaf7fb"

Save-Jpeg `
  "https://static.wikia.nocookie.net/gensin-impact/images/f/f9/CoSM_The_Harbor_of_Stone_and_Contracts.png/revision/latest?cb=20221128044110&format=original" `
  "liyue-harbor.jpg" 520 180 68 -Background "#dbe9e8"

Save-Jpeg `
  "https://static.wikia.nocookie.net/gensin-impact/images/0/02/4th_Anniversary_Wallpaper_1.png/revision/latest?cb=20241027124611&format=original" `
  "anniversary.jpg" 320 210 68 -Background "#f3e9dc"

Get-ChildItem $AssetDir -Filter "*.jpg" | Select-Object Name,Length
