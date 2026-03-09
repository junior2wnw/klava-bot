$ErrorActionPreference = "Stop"

$releaseDir = Join-Path $PSScriptRoot "..\\apps\\desktop\\release"
if (Test-Path $releaseDir) {
  Remove-Item $releaseDir -Recurse -Force
}

npm run build
npm run dist:win --workspace @klava/desktop
