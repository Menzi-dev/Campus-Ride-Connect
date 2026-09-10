# Test driver workflow - login then fetch requests
$baseUrl = "http://127.0.0.1:8080/api"

# Step 1: Register a driver if not exists
Write-Host "Step 1: Login as driver..." -ForegroundColor Yellow
$loginBody = @{
    email = "driver2@example.com"
    password = "password123"
} | ConvertTo-Json

try {
    $loginResp = Invoke-RestMethod -Uri "$baseUrl/auth/login" `
        -Method Post `
        -Headers @{"Content-Type" = "application/json"} `
        -Body $loginBody
    
    $driverToken = $loginResp.token
    Write-Host "Login successful!" -ForegroundColor Green
    Write-Host "Token: $($driverToken.Substring(0, 50))..." -ForegroundColor Green
    
    # Step 2: Get driver requests
    Write-Host "`nStep 2: Fetching pending requests..." -ForegroundColor Yellow
    $headers = @{
        "Authorization" = "Bearer $driverToken"
        "Content-Type" = "application/json"
    }
    
    $requests = Invoke-RestMethod -Uri "$baseUrl/driver/requests" -Method Get -Headers $headers
    
    Write-Host "Found $($requests.Count) pending requests:" -ForegroundColor Green
    $requests | ForEach-Object {
        Write-Host "  - ID: $($_.id), Rider: $($_.riderName), Pickup: $($_.pickup)"
    }
    
    # Step 3: Get specific request details  
    if ($requests.Count -gt 0) {
        $testId = $requests[0].id
        Write-Host "`nStep 3: Fetching detailed info for request ID: $testId..." -ForegroundColor Yellow
        
        $details = Invoke-RestMethod -Uri "$baseUrl/driver/requests/$testId" `
            -Method Get `
            -Headers $headers
        
        Write-Host "Success! Request details:" -ForegroundColor Green
        Write-Host "  Rider: $($details.riderName)"
        Write-Host "  Pickup: $($details.pickup)"
        Write-Host "  Destination: $($details.destination)"
        Write-Host "  Fare: $($details.fare)"
        Write-Host "  Distance: $($details.distance)"
        Write-Host "  Est. Time: $($details.estimatedTime)"
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host "Details: $($_.ErrorDetails)" -ForegroundColor Red
    }
}
