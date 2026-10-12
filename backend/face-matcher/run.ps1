$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$pythonPath = Join-Path $projectRoot '.local-face/venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) {
    throw 'Local matcher is not installed. Follow docs/ride-face-verification.md first.'
}
& $pythonPath (Join-Path $PSScriptRoot 'server.py')
