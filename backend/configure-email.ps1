# Local email setup: prepare mail configuration using the values supplied to this helper.
# Where: backend/configure-email.ps1.
# How: PowerShell runs the commands below in order. Its variables supply local inputs; launch
# commands start a service and any Invoke-RestMethod/Invoke-WebRequest calls exchange data with API
# endpoints.
$ErrorActionPreference = 'Stop'
$taskDirectory = Join-Path $PSScriptRoot 'config'
$taskFile = Join-Path $taskDirectory 'mail.properties'
if (Test-Path -LiteralPath $taskFile) {
    throw 'Private config already exists. Edit backend/config/mail.properties to update it; this script will not overwrite it.'
}
$taskUrl = (Read-Host 'Current frontend URL (HTTPS link for phones, or http://localhost:8085 for this computer)').Trim().TrimEnd('/')
$taskUri = $null
if (-not [Uri]::TryCreate($taskUrl, [UriKind]::Absolute, [ref]$taskUri) -or $taskUri.Scheme -notin @('http','https') -or $taskUri.Query -or $taskUri.Fragment -or $taskUri.UserInfo) {
    throw 'Enter a valid HTTP(S) app URL without query, fragment or embedded credentials.'
}
$taskSecret = Read-Host 'Existing Gmail App Password for saneledlomo08@gmail.com (hidden)' -AsSecureString
$taskPointer = [IntPtr]::Zero
try {
    $taskPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecret)
    $taskPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPointer) -replace '\s',''
    if ($taskPassword -notmatch '^[a-zA-Z]{16}$') { throw 'Enter the existing 16-letter Google App Password, not your Gmail account password.' }
    New-Item -ItemType Directory -Path $taskDirectory -Force | Out-Null
    $taskContent = "GMAIL_USERNAME=saneledlomo08@gmail.com`nGMAIL_APP_PASSWORD=$taskPassword`nAPP_PUBLIC_URL=$taskUrl`nAPP_MAIL_REQUIRED=true`nEMAIL_VERIFICATION_EXPIRY_MINUTES=60`nEMAIL_VERIFICATION_COOLDOWN_SECONDS=60`n"
    [IO.File]::WriteAllText($taskFile, $taskContent, [Text.UTF8Encoding]::new($false))
    $taskAcl = Get-Acl -LiteralPath $taskFile
    $taskAcl.SetAccessRuleProtection($true, $false)
    foreach ($taskIdentity in @([Security.Principal.WindowsIdentity]::GetCurrent().User.Value, 'S-1-5-18', 'S-1-5-32-544')) {
        $taskRule = [Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($taskIdentity), 'FullControl', 'Allow')
        $taskAcl.AddAccessRule($taskRule)
    }
    Set-Acl -LiteralPath $taskFile -AclObject $taskAcl
    Write-Output 'Saved private backend configuration. Future backend starts load it automatically. SMTP delivery still needs testing.'
} finally {
    $taskPassword = $null; $taskContent = $null
    if ($taskPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPointer) }
}
