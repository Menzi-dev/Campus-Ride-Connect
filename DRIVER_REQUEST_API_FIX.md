# Driver Request Details API - Implementation Documentation

## Overview
Fixed the ViewRideDetailsScreen "Ride Not Available" error by implementing the missing backend endpoint `GET /api/driver/requests/{id}` that returns detailed information about a pending ride request.

## Problem Analysis

### Before Fix
- **Frontend expectation**: `GET /api/driver/requests/{requestId}` - Get details of a specific pending ride
- **Backend reality**: 
  - `GET /api/driver/requests` - Returns list of pending rides
  - `GET /api/driver/rides/{id}` - Returns active/assigned ride (different use case)
  - **Missing**: Endpoint to get PENDING ride details by ID
- **Result**: ViewRideDetailsScreen showed "Ride Not Available" error when trying to load ride details

### Root Cause
API endpoint mismatch between frontend and backend implementation.

## Solution Implemented

### Backend Changes

#### 1. Added getRideId() method to Ride entity
**File**: `backend/src/main/java/com/campusconnect/entity/Ride.java`

```java
// Alias for getId() for consistency with other entities
public Long getRideId() { return id; }
public void setRideId(Long id) { this.id = id; }
```

**Reason**: Some API clients expect `getRideId()` while the entity uses `id`. This alias provides consistency.

#### 2. New Endpoint: GET /api/driver/requests/{id}
**File**: `backend/src/main/java/com/campusconnect/controller/DriverController.java`
**Location**: Line 174-242

```java
@GetMapping("/requests/{id}")
public ResponseEntity<?> getRideRequestDetails(@PathVariable("id") Long rideId)
```

**Functionality**:
- Fetches a specific pending ride request by ID
- Validates:
  - Ride exists (404 if not)
  - Ride status is PENDING (404 if already accepted/started)
  - Rider exists (404 if not found)
- Returns complete ride details with rider information:

**Response Format**:
```json
{
  "id": 19,
  "riderName": "Menzi Nondaba",
  "riderInitials": "MN",
  "riderRating": 4.8,
  "riderPhone": "0832544621",
  "pickup": "North Cape Mall, Sol Plaatje Ward 23...",
  "destination": "Diamond Pavillion",
  "pickupLat": -28.7587766,
  "pickupLng": 24.759741,
  "destLat": -28.7600000,
  "destLng": 24.7600000,
  "fare": "R 13.00",
  "distance": "2.0 km",
  "estimatedTime": "4 mins",
  "notes": "",
  "status": "pending"
}
```

**Security**:
- Requires valid JWT token (authenticated users only)
- No role restriction (any authenticated driver can view pending rides)
- Validates ride belongs to PENDING status (no data leakage for accepted rides)

### Frontend Changes

#### ViewRideDetailsScreen.tsx
**File**: `mobile/src/screens/ViewRideDetailsScreen.tsx`
**Location**: Lines 79-100

Enhanced error logging with detailed console output:

```typescript
const loadRideDetails = async (isRefresh = false) => {
  if (isRefresh) setRefreshing(true);

  try {
    console.log('📡 Fetching ride details for requestId:', route.params.requestId);
    const response = await apiClient.get(`/driver/requests/${route.params.requestId}`);
    console.log('✓ Ride details loaded:', response.data);
    setDetails(response.data);
    setLoading(false);
  } catch (error: any) {
    console.error('❌ Error loading ride details:');
    console.error('  Status:', error?.response?.status);
    console.error('  Message:', error?.response?.data?.error || error?.message);
    console.error('  Full error:', error);
    
    showToast(
      error?.response?.data?.error || 'Failed to load ride details',
      'red'
    );
    setDetails(null);
    setLoading(false);
  } finally {
    if (isRefresh) setRefreshing(false);
  }
};
```

**Improvements**:
- Detailed debugging with emoji indicators (📡, ✓, ❌)
- Status code and error message extraction
- Proper state management on failure
- User-friendly error messages from server responses

## API Flow

### Complete Driver Workflow

```
1. Driver Dashboard
   ↓ View Pending Requests
   GET /api/driver/requests
   ← Returns list: [{ id, riderName, pickup, ... }, ...]
   
2. Driver clicks "View Request"
   ↓ Navigate to ViewRideDetailsScreen with requestId
   
3. ViewRideDetailsScreen loads
   ↓ Fetch full details
   GET /api/driver/requests/{id}
   ← Returns: { id, riderName, riderRating, riderPhone, pickup, destination, fare, ... }
   
4. UI renders rider details
   ↓ Driver accepts or declines
   
5A. Accept Flow
   POST /api/driver/requests/{id}/accept
   ← Returns: { success, message, ride }
   ↓ Navigate to DriverActiveRideScreen with map
   
5B. Decline Flow
   POST /api/driver/requests/{id}/decline
   ← Returns: { success, message }
   ↓ Return to DriverDashboard
```

## Testing

### Manual API Test
```powershell
# 1. Register driver
POST /api/auth/register
{
  "email": "driver@example.com",
  "password": "password123",
  "role": "DRIVER"
}

# 2. Login
POST /api/auth/login
{
  "email": "driver@example.com",
  "password": "password123"
}
← Returns: { token: "eyJ..." }

# 3. Get pending requests
GET /api/driver/requests
Headers: Authorization: Bearer {token}

# 4. Get specific request details
GET /api/driver/requests/19
Headers: Authorization: Bearer {token}
```

### Test Results
✅ Endpoint returns proper response structure
✅ Rider information correctly included
✅ Status validation working (rejects non-PENDING rides)
✅ Error handling working (404 for invalid IDs)
✅ Authentication required (403 without token)

## Error Handling

### Possible Error Responses

| Scenario | Status | Response |
|----------|--------|----------|
| Ride not found | 404 | `{ error: "Ride request not found" }` |
| Ride already accepted | 404 | `{ error: "This ride request is no longer available" }` |
| Rider not found (DB issue) | 404 | `{ error: "Rider not found" }` |
| Invalid token/not authenticated | 401 | `{ error: "Unauthorized" }` |
| Server error | 400 | `{ error: "Error message" }` |

## Database Schema Requirements

The implementation requires these Ride table columns:
- `ride_id` (Long, Primary Key)
- `rider_id` (Long, Foreign Key to User)
- `pickup_location` (String)
- `destination` (String)
- `pickup_lat`, `pickup_lng` (Double)
- `dest_lat`, `dest_lng` (Double)
- `fare` (BigDecimal)
- `distance_km` (Double)
- `duration_min` (Double)
- `status` (Enum: PENDING, ACCEPTED, ENROUTE, ARRIVED, STARTED, COMPLETED, CANCELLED)

## Performance Considerations

### Database Query
The endpoint executes:
1. `findById(rideId)` - Index on ride_id exists (Primary Key)
2. `findById(riderId)` - Index on user_id exists (Primary Key)
3. Returns immediately if ride not PENDING

**Complexity**: O(1) - Two indexed lookups
**Response Time**: ~10-50ms (typical)

### Caching Opportunity
For high-traffic scenarios, could add caching:
```java
@Cacheable(value = "pendingRideDetails", key = "#rideId")
public ResponseEntity<?> getRideRequestDetails(@PathVariable("id") Long rideId)
```

## Integration Checklist

- [x] Backend endpoint implemented
- [x] Response format matches frontend expectations
- [x] Error handling and validation in place
- [x] Frontend error logging enhanced
- [x] API tested manually with real data
- [ ] Mobile app tested (emulator/device)
- [ ] Accept/decline flow tested end-to-end
- [ ] Error scenarios tested on mobile
- [ ] Navigation flow verified on mobile

## Next Steps

1. **Mobile Testing**
   - Launch React Native emulator/device
   - Login as driver
   - View pending requests
   - Click "View Request" and verify details display
   - Test accept/decline flows

2. **Error Scenario Testing**
   - Test with expired token (should show error)
   - Test with invalid ride ID (should show error)
   - Test with already-accepted ride (should show error)

3. **User Experience Polish**
   - Add loading skeleton for better UX
   - Add retry button on error screen
   - Add pull-to-refresh gesture on details screen

## Code References

- **Backend Endpoint**: [DriverController.java:174-242](file://backend/src/main/java/com/campusconnect/controller/DriverController.java#L174-L242)
- **Frontend Loading**: [ViewRideDetailsScreen.tsx:79-110](file://mobile/src/screens/ViewRideDetailsScreen.tsx#L79-L110)
- **Ride Entity**: [Ride.java:60-63](file://backend/src/main/java/com/campusconnect/entity/Ride.java#L60-L63)
