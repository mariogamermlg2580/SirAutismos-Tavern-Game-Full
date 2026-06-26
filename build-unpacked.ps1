$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $root "dist\Sir Autismos Tavern Cards and Stuff"
$electronDist = Join-Path $root "node_modules\electron\dist"
$appDir = Join-Path $out "resources\app"

if (Test-Path $out) {
  Remove-Item -LiteralPath $out -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $out | Out-Null
Copy-Item -Path (Join-Path $electronDist "*") -Destination $out -Recurse -Force

$oldExe = Join-Path $out "electron.exe"
$newExe = Join-Path $out "Sir Autismos Tavern Cards and Stuff.exe"
if (Test-Path $oldExe) {
  Rename-Item -LiteralPath $oldExe -NewName "Sir Autismos Tavern Cards and Stuff.exe"
}

New-Item -ItemType Directory -Force -Path $appDir | Out-Null
Copy-Item -LiteralPath (Join-Path $root "index.html") -Destination $appDir -Force
Copy-Item -LiteralPath (Join-Path $root "main.js") -Destination $appDir -Force
Copy-Item -LiteralPath (Join-Path $root "preload.js") -Destination $appDir -Force
Copy-Item -LiteralPath (Join-Path $root "package.json") -Destination $appDir -Force
New-Item -ItemType Directory -Force -Path (Join-Path $appDir "server") | Out-Null
Copy-Item -LiteralPath (Join-Path $root "server\multiplayer-server.js") -Destination (Join-Path $appDir "server") -Force
New-Item -ItemType Directory -Force -Path (Join-Path $appDir "assets") | Out-Null
Copy-Item -LiteralPath (Join-Path $root "assets\icon.ico") -Destination (Join-Path $appDir "assets") -Force

Write-Host $newExe
