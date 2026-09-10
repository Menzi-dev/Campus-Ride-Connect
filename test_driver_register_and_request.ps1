# Register and test driver
$baseUrl = "http://127.0.0.1:8080/api"

# Step 1: Register driver
Write-Host "Step 1: Registering driver..." -ForegroundColor Yellow
$regBody = @{
    fullName = "Test Driver 2"
    email = "driver2@example.com"
    password = "password123"
    phone = "0712345678"
    studentNumber = "00000002"
    yearOfStudy = 2
    emergencyContact = "0700000000"
    role = "DRIVER"
} | ConvertTo-Json

try {
    $regResp = Invoke-RestMethod -Uri "$baseUrl/auth/register" `
        -Method Post `
        -Headers @{"Content-Type" = "application/json"} `
        -Body $regBody `
        -ErrorAction SilentlyContinue
    
    Write-Host "Registration response: $($regResp.message)" -ForegroundColor Green
} catch {
    Write-Host "Registration error (user may exist): $($_.Exception.Message)" -ForegroundColor Yellow
}

# Step 2: Login
Write-Host "`nStep 2: Login as driver..." -ForegroundColor Yellow
$loginBody = @{
    email = "driver2@example.com"
    password = "password123"
} | ConvertTo-Json

$loginResp = Invoke-RestMethod -Uri "$baseUrl/auth/login" `
    -Method Post `
    -Headers @{"Content-Type" = "application/json"} `
    -Body $loginBody

$driverToken = $loginResp.token
Write-Host "Login successful! Token: $($driverToken.Substring(0, 50))..." -ForegroundColor Green

# Step 3: Get driver requests
Write-Host "`nStep 3: Fetching pending requests..." -ForegroundColor Yellow
$headers = @{
    "Authorization" = "Bearer $driverToken"
    "Content-Type" = "application/json"
}

$requests = Invoke-RestMethod -Uri "$baseUrl/driver/requests" -Method Get -Headers $headers

Write-Host "Found $($requests.Count) pending requests" -ForegroundColor Green
if ($requests.Count -gt 0) {
    $requests | ForEach-Object {
        Write-Host "  - ID: $($_.id), Rider: $($_.riderName), Pickup: $($_.pickup)"
    }
    
    # Step 4: Get specific request details
    $testId = $requests[0].id
    Write-Host "`nStep 4: Fetching detailed info for request $testId..." -ForegroundColor Yellow
    
    $details = Invoke-RestMethod -Uri "$baseUrl/driver/requests/$testId" `
        -Method Get `
        -Headers $headers
    
    Write-Host "Success! Request details:" -ForegroundColor Green
    Write-Host "  Rider: $($details.riderName) ($($details.riderInitials))"
    Write-Host "  Rating: $($details.riderRating)"
    Write-Host "  Phone: $($details.riderPhone)"
    Write-Host "  Pickup: $($details.pickup)"
    Write-Host "  Destination: $($details.destination)"
    Write-Host "  Fare: $($details.fare)"
    Write-Host "  Distance: $($details.distance)"
    Write-Host "  Est. Time: $($details.estimatedTime)"
} else {
    Write-Host "No pending requests available" -ForegroundColor Yellow
}
