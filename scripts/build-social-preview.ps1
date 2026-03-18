param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath,

  [int]$Width = 1200,
  [int]$Height = 630
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$inputFullPath = [System.IO.Path]::GetFullPath($InputPath)
$outputFullPath = [System.IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path -Parent $outputFullPath

if (-not (Test-Path $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

$source = [System.Drawing.Image]::FromFile($inputFullPath)

try {
  $scale = [Math]::Max($Width / $source.Width, $Height / $source.Height)
  $scaledWidth = [int][Math]::Ceiling($source.Width * $scale)
  $scaledHeight = [int][Math]::Ceiling($source.Height * $scale)

  $resized = New-Object System.Drawing.Bitmap($scaledWidth, $scaledHeight)
  $resizedGraphics = [System.Drawing.Graphics]::FromImage($resized)

  try {
    $resizedGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $resizedGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $resizedGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $resizedGraphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $resizedGraphics.DrawImage($source, 0, 0, $scaledWidth, $scaledHeight)
  } finally {
    $resizedGraphics.Dispose()
  }

  $x = [int][Math]::Floor(($scaledWidth - $Width) / 2)
  $y = 0
  $cropRect = New-Object System.Drawing.Rectangle($x, $y, $Width, $Height)
  $cropped = New-Object System.Drawing.Bitmap($Width, $Height)
  $croppedGraphics = [System.Drawing.Graphics]::FromImage($cropped)

  try {
    $croppedGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $croppedGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $croppedGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $croppedGraphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $croppedGraphics.DrawImage(
      $resized,
      (New-Object System.Drawing.Rectangle(0, 0, $Width, $Height)),
      $cropRect,
      [System.Drawing.GraphicsUnit]::Pixel
    )
    $cropped.Save($outputFullPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $croppedGraphics.Dispose()
    $cropped.Dispose()
    $resized.Dispose()
  }
} finally {
  $source.Dispose()
}
