# Backend email launcher: provide Gmail SMTP settings for the backend run using the configured local
# values.
# Where: backend/run-with-gmail.ps1.
# How: PowerShell runs the commands below in order. Its variables supply local inputs; launch
# commands start a service and any Invoke-RestMethod/Invoke-WebRequest calls exchange data with API
# endpoints.
$ErrorActionPreference = 'Stop'
if (Get-NetTCPConnection -State Listen -LocalPort 8080 -ErrorAction SilentlyContinue) {
    throw 'Port 8080 is already in use. Stop the existing backend before starting another.'
}
Push-Location $PSScriptRoot
try {
    & mvn.cmd spring-boot:run '-Dspring-boot.run.arguments=--app.mail.required=true'
    if ($LASTEXITCODE -ne 0) { throw 'Backend startup failed. Check the configuration diagnostic above.' }
} finally { Pop-Location }
