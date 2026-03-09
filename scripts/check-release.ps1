$ErrorActionPreference = "Stop"

$portablePath = Join-Path $PSScriptRoot "..\\apps\\desktop\\release\\Klava 0.1.0.exe"
$asarPath = Join-Path $PSScriptRoot "..\\apps\\desktop\\release\\win-unpacked\\resources\\app.asar"

if (-not (Test-Path $portablePath)) {
  throw "Portable build not found at $portablePath"
}

if (-not (Test-Path $asarPath)) {
  throw "Packaged app.asar not found at $asarPath"
}

$asarListing = node "$PSScriptRoot\\..\\node_modules\\@electron\\asar\\bin\\asar.js" list $asarPath
if ($LASTEXITCODE -ne 0) {
  throw "Failed to inspect packaged app.asar"
}

$asarListingText = ($asarListing -join "`n")

if ($asarListingText -notmatch 'node_modules\\@klava\\runtime\\dist\\index\.cjs') {
  throw "Packaged app is missing @klava/runtime dist/index.cjs"
}

if ($asarListingText -notmatch 'node_modules\\@klava\\contracts\\dist\\index\.cjs') {
  throw "Packaged app is missing @klava/contracts dist/index.cjs"
}

Write-Host "Release artifact found: $portablePath"
Write-Host "Packaged runtime entries point to dist/*.cjs artifacts."
