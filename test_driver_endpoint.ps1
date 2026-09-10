# Test driver request endpoint
$baseUrl = "http://127.0.0.1:8080/api"
$driverToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4IiwiZW1haWwiOiJkcml2ZXIyQGV4YW1wbGUuY29tIiwicm9sZSI6IkRSSVZFUiIsImlhdCI6MTcyNTk0ODAyMiwiZXhwIjo5OTk5OTk5OTk5fQ.jVnrRKAEYhgBSl1pOeFp8PKQfVP3qr2PvCKlzQj5OiI"

Write-Host "=== Testing Driver Request Endpoint ===" -ForegroundColor Cyan

$headers = @{
    "Authorization" = "Bearer $driverToken"
    "Content-Type" = "application/json"
}

Write-Host "`nFetching pending requests list..." -ForegroundColor Yellow
$requests = Invoke-RestMethod -Uri "$baseUrl/driver/requests" -Method Get -Headers $headers

Write-Host "Found $(($requests | Measure-Object).Count) pending requests:" -ForegroundColor Green
foreach ($req in $requests) {
    Write-Host "  ID: $($req.id), Rider: $($req.riderName)"
}

if ($requests.Count -gt 0) {
    $testId = $requests[0].id
    Write-Host "`nGetting detailed info for request ID: $testId..." -ForegroundColor Yellow
    $details = Invoke-RestMethod -Uri "$baseUrl/driver/requests/$testId" -Method Get -Headers $headers
    Write-Host "Success! Details:" -ForegroundColor Green
    $details | ConvertTo-Json | Write-Host
}

