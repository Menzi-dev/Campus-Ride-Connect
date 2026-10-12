$ErrorActionPreference = 'Stop'
if (Get-NetTCPConnection -State Listen -LocalPort 8080 -ErrorAction SilentlyContinue) {
    throw 'Port 8080 is already in use. Stop the existing backend before starting another.'
}
Push-Location $PSScriptRoot
try {
    & mvn.cmd spring-boot:run '-Dspring-boot.run.arguments=--app.mail.required=true'
    if ($LASTEXITCODE -ne 0) { throw 'Backend startup failed. Check the configuration diagnostic above.' }
} finally { Pop-Location }
