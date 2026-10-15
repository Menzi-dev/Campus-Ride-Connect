# Face service launcher: locate the local Python environment and run the matcher alongside the
# backend.
# Where: backend/face-matcher/run.ps1.
# How: PowerShell runs the commands below in order. Its variables supply local inputs; launch
# commands start a service and any Invoke-RestMethod/Invoke-WebRequest calls exchange data with API
# endpoints.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$pythonPath = Join-Path $projectRoot '.local-face/venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) {
    throw 'Local matcher is not installed. Follow the face-matcher setup in README.md first.'
}
& $pythonPath (Join-Path $PSScriptRoot 'server.py')
