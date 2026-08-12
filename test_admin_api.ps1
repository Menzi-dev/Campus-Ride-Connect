#!/usr/bin/env powershell

# Test script to verify admin endpoints

$baseUrl = "http://localhost:8080"
$adminEmail = "admin@spu.ac.za"
$adminPassword = "Admin@123456"

Write-Host "=== Campus Connect Admin API Test ===" -ForegroundColor Cyan

# Step 1: Try to register admin user
Write-Host "`n[1] Attempting to register admin user..." -ForegroundColor Yellow
$registerBody = @{
    fullName = "Admin User"
    email = $adminEmail
    password = $adminPassword
    role = "ADMIN"
    phone = "0700000000"
    studentNumber = "00000000"
    yearOfStudy = 0
    emergencyContact = "0700000000"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/auth/register" `
        -Method Post `
        -Headers @{"Content-Type" = "application/json"} `
        -Body $registerBody `
        -UseBasicParsing `
        -TimeoutSec 10
    
    $content = $response.Content | ConvertFrom-Json
    Write-Host "✓ Registration response: $($content.message)" -ForegroundColor Green
    $adminToken = $content.token
} catch {
    Write-Host "⚠ Registration failed (user may already exist): $($_.Exception.Message)" -ForegroundColor Yellow
}

# Step 2: Try to login as admin
Write-Host "`n[2] Attempting to login as admin..." -ForegroundColor Yellow
$loginBody = @{
    email = $adminEmail
    password = $adminPassword
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/auth/login" `
        -Method Post `
        -Headers @{"Content-Type" = "application/json"} `
        -Body $loginBody `
        -UseBasicParsing `
        -TimeoutSec 10
    
    $content = $response.Content | ConvertFrom-Json
    Write-Host "✓ Login successful" -ForegroundColor Green
    $adminToken = $content.token
    Write-Host "  Token: $($adminToken.Substring(0, 20))..." -ForegroundColor Gray
} catch {
    Write-Host "✗ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 3: Test pending approvals endpoint WITHOUT authentication
Write-Host "`n[3] Testing /api/admin/driver-approvals/pending WITHOUT auth..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/admin/driver-approvals/pending" `
        -Method Get `
        -UseBasicParsing `
        -TimeoutSec 10
    
    $content = $response.Content | ConvertFrom-Json
    Write-Host "✓ Endpoint responded (no auth required): Found $($content.Count) pending drivers" -ForegroundColor Green
    if ($content.Count -gt 0) {
        $content[0] | ConvertTo-Json
    }
} catch {
    Write-Host "⚠ No auth response: $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
}

# Step 4: Test pending approvals endpoint WITH authentication
Write-Host "`n[4] Testing /api/admin/driver-approvals/pending WITH admin token..." -ForegroundColor Yellow
try {
    $headers = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $adminToken"
    }
    
    $response = Invoke-WebRequest -Uri "$baseUrl/api/admin/driver-approvals/pending" `
        -Method Get `
        -Headers $headers `
        -UseBasicParsing `
        -TimeoutSec 10
    
    $content = $response.Content | ConvertFrom-Json
    Write-Host "✓ Endpoint responded with auth: Found $($content.Count) pending drivers" -ForegroundColor Green
    
    if ($content.Count -gt 0) {
        Write-Host "`nPending drivers:" -ForegroundColor Cyan
        $content | ForEach-Object {
            Write-Host "  - $($_.fullName) ($($_.email))" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ⚠ No pending drivers found in database" -ForegroundColor Yellow
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode
    Write-Host "✗ Endpoint returned error: $statusCode" -ForegroundColor Red
    Write-Host "   Message: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 5: Test dashboard endpoint
Write-Host "`n[5] Testing /api/admin/dashboard WITH admin token..." -ForegroundColor Yellow
try {
    $headers = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $adminToken"
    }
    
    $response = Invoke-WebRequest -Uri "$baseUrl/api/admin/dashboard" `
        -Method Get `
        -Headers $headers `
        -UseBasicParsing `
        -TimeoutSec 10
    
    $content = $response.Content | ConvertFrom-Json
    Write-Host "✓ Dashboard endpoint responded" -ForegroundColor Green
    Write-Host "  Stats:" -ForegroundColor Cyan
    $content.stats | ConvertTo-Json | Write-Host -ForegroundColor Gray
    Write-Host "`n  Approvals count: $($content.approvals.Count)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Dashboard error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
