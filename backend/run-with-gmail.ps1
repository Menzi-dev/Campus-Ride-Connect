$ErrorActionPreference = 'Stop'

$listener = Get-NetTCPConnection -State Listen -LocalPort 8080 -ErrorAction SilentlyContinue
if ($listener) {
    throw 'Port 8080 is already in use. Stop the existing CampusConnect backend, then run this script again.'
}

$gmailUsername = (Read-Host 'Gmail sender address used to create this App Password').Trim().ToLowerInvariant()
if ($gmailUsername -notmatch '^[^\s@]+@gmail\.com$') {
    throw 'Enter the Gmail address that created this App Password.'
}

$securePassword = Read-Host 'Enter the Gmail App Password (input is hidden)' -AsSecureString
$passwordPointer = [IntPtr]::Zero

try {
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $env:GMAIL_USERNAME = $gmailUsername
    $env:GMAIL_APP_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer).Replace(' ', '')

    Push-Location $PSScriptRoot
    try {
        mvn spring-boot:run
        if ($LASTEXITCODE -ne 0) {
            throw 'Spring Boot exited with an error. Check the backend output above.'
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    $env:GMAIL_USERNAME = $null
    $env:GMAIL_APP_PASSWORD = $null
    if ($passwordPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
}
