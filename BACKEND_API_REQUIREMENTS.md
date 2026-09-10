# Backend API Checklist for Driver Screen Features

## Overview
This document outlines the backend requirements to support the new driver screen features implemented in the mobile app.

---

## ✅ Required API Endpoints

### 1. Get Pending Ride Requests
```
GET /api/driver/requests
```

**Purpose**: Fetch all pending ride requests for the driver

**Authentication**: Required (Bearer token)

**Expected Response**:
```json
[
  {
    "id": "req_123",
    "riderName": "John Doe",
    "riderInitials": "JD",
    "riderRating": 4.8,
    "riderPhone": "+27123456789",
    "pickup": "Main Campus",
    "destination": "Student Center",
    "pickupLat": -28.7587766,
    "pickupLng": 24.759741,
    "destLat": -28.7600000,
    "destLng": 24.7600000,
    "fare": "R 45.00",
    "distance": "3.2 km",
    "estimatedTime": "12 mins",
    "notes": "Please use south entrance",
    "status": "pending"
  }
]
```

**Status Code**: 
- 200: Success
- 401: Unauthorized
- 500: Server error

---

### 2. Get Ride Request Details
```
GET /api/driver/requests/{requestId}
```

**Purpose**: Fetch detailed information about a specific ride request

**Parameters**:
- `requestId` (path): The ride request ID

**Authentication**: Required

**Expected Response**:
```json
{
  "id": "req_123",
  "riderName": "John Doe",
  "riderInitials": "JD",
  "riderRating": 4.8,
  "riderPhone": "+27123456789",
  "pickup": "Main Campus",
  "destination": "Student Center",
  "pickupLat": -28.7587766,
  "pickupLng": 24.759741,
  "destLat": -28.7600000,
  "destLng": 24.7600000,
  "fare": "R 45.00",
  "distance": "3.2 km",
  "estimatedTime": "12 mins",
  "notes": "Please use south entrance"
}
```

**Status Codes**:
- 200: Success
- 404: Ride request not found
- 401: Unauthorized
- 500: Server error

---

### 3. Accept Ride Request
```
POST /api/driver/requests/{requestId}/accept
```

**Purpose**: Driver accepts a ride request and becomes assigned to the ride

**Parameters**:
- `requestId` (path): The ride request ID

**Authentication**: Required

**Request Body**: Empty or minimal

**Expected Response**:
```json
{
  "success": true,
  "message": "Ride accepted successfully",
  "rideId": 123
}
```

**Status Codes**:
- 200: Successfully accepted
- 400: Ride already accepted/completed
- 404: Ride request not found
- 401: Unauthorized
- 500: Server error

---

### 4. Decline Ride Request
```
POST /api/driver/requests/{requestId}/decline
```

**Purpose**: Driver declines a ride request

**Parameters**:
- `requestId` (path): The ride request ID

**Authentication**: Required

**Request Body**: Empty or minimal

**Expected Response**:
```json
{
  "success": true,
  "message": "Ride declined successfully"
}
```

**Status Codes**:
- 200: Successfully declined
- 400: Ride already accepted/completed
- 404: Ride request not found
- 401: Unauthorized
- 500: Server error

---

### 5. Get Active Ride Information
```
GET /api/driver/rides/{rideId}
```

**Purpose**: Fetch current active ride details for map display

**Parameters**:
- `rideId` (path): The ride ID

**Authentication**: Required

**Expected Response**:
```json
{
  "id": 123,
  "status": "ACCEPTED",
  "pickupLocation": "Main Campus",
  "destination": "Student Center",
  "pickupLat": -28.7587766,
  "pickupLng": 24.759741,
  "destLat": -28.7600000,
  "destLng": 24.7600000,
  "fare": 45.00,
  "riderPhone": "+27123456789",
  "riderName": "John Doe"
}
```

**Status Codes**:
- 200: Success
- 404: Ride not found
- 401: Unauthorized
- 500: Server error

---

### 6. Update Ride Status
```
POST /api/driver/rides/{rideId}/status
```

**Purpose**: Update the status of an active ride (ACCEPTED → ARRIVED → STARTED → COMPLETED)

**Parameters**:
- `rideId` (path): The ride ID

**Authentication**: Required

**Request Body**:
```json
{
  "status": "ARRIVED"
}
```

**Status Values**:
- `ACCEPTED`: Driver accepted the ride
- `ENROUTE`: Driver is on the way to pickup (optional)
- `ARRIVED`: Driver arrived at pickup location
- `STARTED`: Trip has started (passenger boarded)
- `COMPLETED`: Trip completed

**Expected Response**:
```json
{
  "id": 123,
  "status": "ARRIVED",
  "updatedAt": "2024-01-15T14:30:00Z"
}
```

**Status Codes**:
- 200: Successfully updated
- 400: Invalid status or invalid state transition
- 404: Ride not found
- 401: Unauthorized
- 500: Server error

---

### 7. Get Driver Statistics
```
GET /api/driver/stats
```

**Purpose**: Fetch driver statistics including earnings, rides, rating

**Authentication**: Required

**Expected Response**:
```json
{
  "todayRides": 5,
  "earnings": 225.50,
  "rating": 4.7,
  "totalRides": 147,
  "online": true
}
```

**Status Codes**:
- 200: Success
- 401: Unauthorized
- 500: Server error

---

### 8. Set Driver Online Status
```
POST /api/driver/online
```

**Purpose**: Toggle driver online/offline status

**Authentication**: Required

**Request Body**:
```json
{
  "online": true
}
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Status updated",
  "online": true
}
```

**Status Codes**:
- 200: Successfully updated
- 400: Invalid request
- 401: Unauthorized
- 500: Server error

---

## 🗄️ Database Requirements

### Required Tables & Columns

#### `rides` table
Ensure these columns exist:
```sql
- id (INT, PK)
- rider_id (INT, FK)
- driver_id (INT, FK, NULLABLE)
- status (ENUM: 'PENDING', 'ACCEPTED', 'ENROUTE', 'ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED')
- pickup_location (VARCHAR)
- destination (VARCHAR)
- pickup_lat (DECIMAL)
- pickup_lng (DECIMAL)
- dest_lat (DECIMAL)
- dest_lng (DECIMAL)
- fare (DECIMAL)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### `drivers` table
Ensure these columns exist:
```sql
- id (INT, PK)
- user_id (INT, FK)
- online (BOOLEAN, DEFAULT: false)
- rating (DECIMAL)
- license_plate (VARCHAR)
- approved (BOOLEAN)
```

#### `users` table
Ensure these columns exist:
```sql
- id (INT, PK)
- full_name (VARCHAR)
- email (VARCHAR)
- phone_number (VARCHAR)
- approved (BOOLEAN)
```

---

## 🔐 Authentication & Security

1. **Token Validation**: All endpoints require valid JWT bearer token
2. **User Context**: Extract current user ID from security context
3. **Authorization**: 
   - Drivers can only accept/decline their own requests
   - Drivers can only view/update their own active rides
   - Drivers can only see their own statistics
4. **Data Privacy**: 
   - Rider phone numbers should only be visible to assigned driver
   - Don't expose sensitive information in error messages

---

## ⚠️ Error Handling

All endpoints should return consistent error responses:

```json
{
  "error": "Error message",
  "message": "Human-readable error message",
  "timestamp": "2024-01-15T14:30:00Z",
  "status": 400
}
```

**Common Error Cases**:
- Invalid request ID format
- Ride already accepted by another driver
- Ride no longer available
- Driver not approved
- Driver offline attempting to accept ride
- Invalid state transition for ride status

---

## 🔄 Data Flow

### Accept Ride Flow
```
1. GET /api/driver/requests/{requestId} → Load ride details
2. POST /api/driver/requests/{requestId}/accept → Accept ride
3. Navigation to DriverActiveRide screen
4. GET /api/driver/rides/{rideId} → Load active ride
5. POST /api/driver/rides/{rideId}/status → Update to ARRIVED
```

### Dashboard Refresh Flow
```
1. GET /api/driver/stats → Update earnings, rides count
2. GET /api/driver/requests → Update pending requests list
3. Display toast notifications
```

### Online Status Flow
```
1. POST /api/driver/online → Toggle status
2. GET /api/driver/stats → Refresh stats (online flag)
3. Backend should stop sending ride requests if offline
```

---

## 📊 Response Time Requirements

For optimal user experience, maintain these response times:

- **GET requests**: < 500ms
- **POST requests**: < 1000ms
- **Map loading**: < 2000ms total (including OSRM routing)

---

## 🧪 Testing Endpoints

### Example CURL Commands

**Get Pending Requests**:
```bash
curl -X GET "http://localhost:8080/api/driver/requests" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Accept Ride**:
```bash
curl -X POST "http://localhost:8080/api/driver/requests/req_123/accept" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Update Status to ARRIVED**:
```bash
curl -X POST "http://localhost:8080/api/driver/rides/123/status" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"ARRIVED"}'
```

**Toggle Online Status**:
```bash
curl -X POST "http://localhost:8080/api/driver/online" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"online":true}'
```

---

## ✅ Implementation Checklist

- [ ] All required endpoints implemented
- [ ] Error handling in place
- [ ] Database columns verified
- [ ] JWT authentication working
- [ ] Response format matches documentation
- [ ] Status codes correct
- [ ] Phone number privacy secured
- [ ] Performance optimized (response times < targets)
- [ ] Test all endpoints with mobile app
- [ ] Verify state transitions (ride status)
- [ ] Confirm online status logic
- [ ] Test refresh functionality
- [ ] Validate error messages

---

## 📝 Notes

- Ride request IDs and ride IDs might be different types (String vs Integer)
- Adjust SQL queries based on actual table structure
- Consider adding request/response logging for debugging
- Implement rate limiting if needed
- Add CORS configuration if frontend on different domain
- Keep JWT token expiration reasonable (1-2 hours recommended)

---

## 🚀 Deployment Checklist

- [ ] CORS properly configured for mobile app domain
- [ ] JWT secret securely stored
- [ ] Database connection pool optimized
- [ ] API rate limiting enabled
- [ ] Error logging configured
- [ ] Performance monitoring in place
- [ ] Backup and recovery procedures
- [ ] Load testing completed
