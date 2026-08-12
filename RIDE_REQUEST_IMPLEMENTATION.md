# Ride Request System Implementation

## Overview
This document describes the implementation of the ride request system that allows riders to request rides, which are then stored in the database and made available to drivers for approval.

## Architecture

### Frontend Flow (Mobile App)
1. **HomeScreen**: Rider selects pickup location and destination
2. **Route Calculation**: App calculates distance, duration, and fare
3. **Ride Request**: Rider taps "Request Ride" button
4. **API Call**: App sends ride request to backend `/api/rides/request`
5. **Finding Drivers**: App shows "Finding Drivers" overlay with animations
6. **Polling**: App polls `/api/rides/{id}/status` every 3 seconds
7. **Driver Assignment**: When driver accepts the ride, app shows active trip

### Backend Flow
1. **Ride Request Endpoint** (`POST /api/rides/request`)
   - Receives ride details from rider
   - Creates new Ride record with PENDING status
   - Returns ride details to frontend

2. **Driver Requests Endpoint** (`GET /api/driver/requests`)
   - Returns all PENDING rides that haven't been assigned
   - Shows rider information and ride details

3. **Accept Ride Endpoint** (`POST /api/driver/requests/{id}/accept`)
   - Driver accepts a ride request
   - Updates ride status to ACCEPTED
   - Assigns driver_id to the ride

4. **Ride Status Polling** (`GET /api/rides/{id}/status`)
   - Returns current ride status
   - Used by rider to track ride progress

## Database Schema

### Rides Table
```sql
CREATE TABLE rides (
    id                   BIGINT AUTO_INCREMENT PRIMARY KEY,
    rider_id             BIGINT NOT NULL,
    driver_id            BIGINT NULL,
    pickup_location      VARCHAR(200),
    pickup_address       VARCHAR(255),
    destination          VARCHAR(200),
    destination_address  VARCHAR(255),
    pickup_lat           DECIMAL(10,7),
    pickup_lng           DECIMAL(10,7),
    dest_lat             DECIMAL(10,7),
    dest_lng             DECIMAL(10,7),
    fare                 DECIMAL(6,2),
    distance_km          DECIMAL(5,2),
    duration_minutes     DECIMAL(5,2),
    status               ENUM('PENDING', 'ACCEPTED', 'ENROUTE', 'ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED'),
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (rider_id) REFERENCES users(user_id),
    FOREIGN KEY (driver_id) REFERENCES users(user_id)
);
```

### Ride Status States
- **PENDING**: Ride requested by rider, waiting for driver acceptance
- **ACCEPTED**: Driver has accepted the ride
- **ENROUTE**: Driver is on the way to pickup location
- **ARRIVED**: Driver has arrived at pickup location
- **STARTED**: Ride has started (driver and rider are in vehicle)
- **COMPLETED**: Ride has been completed
- **CANCELLED**: Ride was cancelled by rider or driver

## API Endpoints

### Rider Endpoints

#### 1. Request Ride
```
POST /api/rides/request
Content-Type: application/json
Authorization: Bearer {token}

{
  "pickupAddress": "Library Complex",
  "pickupLat": -28.7411,
  "pickupLng": 24.7685,
  "destinationAddress": "Sports Complex",
  "destinationLat": -28.7445,
  "destinationLng": 24.7715,
  "distance": 0.8,
  "distanceKm": 0.8,
  "duration": 5.2,
  "fare": 8.20
}

Response:
{
  "id": 123,
  "riderId": 456,
  "driverId": null,
  "pickupAddress": "Library Complex",
  "pickupLat": -28.7411,
  "pickupLng": 24.7685,
  "destinationAddress": "Sports Complex",
  "destinationLat": -28.7445,
  "destinationLng": 24.7715,
  "fare": 8.20,
  "distance": 0.8,
  "duration": 5.2,
  "status": "PENDING",
  "createdAt": "2026-08-13T10:00:00",
  "updatedAt": "2026-08-13T10:00:00"
}
```

#### 2. Get Active Ride
```
GET /api/rides/active
Authorization: Bearer {token}

Response:
{
  "id": 123,
  "riderId": 456,
  "driverId": 789,
  "pickupAddress": "Library Complex",
  "destinationAddress": "Sports Complex",
  "status": "ACCEPTED",
  "driver": {
    "id": 789,
    "fullName": "John Driver",
    "rating": 4.8,
    "vehicleMake": "Toyota",
    "vehicleModel": "Corolla",
    "licencePlate": "CA 123-456",
    "phone": "+27821234567"
  }
}
```

#### 3. Get Ride Status
```
GET /api/rides/{id}/status
Authorization: Bearer {token}

Response:
{
  "id": 123,
  "status": "ENROUTE",
  "driverId": 789,
  "updatedAt": "2026-08-13T10:05:00"
}
```

#### 4. Cancel Ride
```
POST /api/rides/{id}/cancel
Authorization: Bearer {token}

Response:
{
  "id": 123,
  "status": "CANCELLED"
}
```

### Driver Endpoints

#### 1. Get Pending Ride Requests
```
GET /api/driver/requests
Authorization: Bearer {token}

Response:
[
  {
    "id": "123",
    "riderName": "John Rider",
    "riderInitials": "JR",
    "pickup": "Library Complex",
    "destination": "Sports Complex",
    "fare": "R 8.20",
    "distance": "0.8 km",
    "status": "pending"
  },
  ...
]
```

#### 2. Accept Ride Request
```
POST /api/driver/requests/{id}/accept
Authorization: Bearer {token}

Response:
{
  "success": true,
  "message": "Ride accepted",
  "ride": {
    "id": 123,
    "riderId": 456,
    "driverId": 789,
    "status": "ACCEPTED",
    ...
  }
}
```

#### 3. Decline Ride Request
```
POST /api/driver/requests/{id}/decline
Authorization: Bearer {token}

Response:
{
  "success": true,
  "message": "Ride request declined"
}
```

## Frontend Integration

### HomeScreen Component
The HomeScreen component handles:
1. **Location Detection**: Detects user's current location
2. **Destination Selection**: Shows nearby places and search results
3. **Route Calculation**: Calculates distance, duration, and fare
4. **Ride Request**: Sends ride request to backend
5. **Finding Drivers Overlay**: Shows animated searching screen
6. **Status Polling**: Polls ride status every 3 seconds
7. **Active Trip Display**: Shows driver info and trip progress

### Key State Variables
- `userLocation`: Current location coordinates
- `destination`: Selected destination
- `currentRide`: Active ride object
- `currentRideId`: ID of active ride
- `findingDriversVisible`: Whether finding drivers overlay is visible
- `driverFound`: Whether a driver has accepted the ride
- `tripStatus`: Current trip status (enroute, arrived, started, completed)

### Demo Mode Fallback
If the backend is unavailable, the app falls back to demo mode which simulates:
- Finding a driver after 4-7 seconds
- Simulating trip progress
- Showing mock driver information

## Files Modified/Created

### Backend Files
1. **src/main/java/com/campusconnect/dto/RideRequest.java**
   - Added: pickupAddress, destinationAddress, duration fields

2. **src/main/java/com/campusconnect/entity/Ride.java**
   - Added: pickupAddress, destinationAddress, durationMinutes, updatedAt
   - Added: New status values (ACCEPTED, ENROUTE, ARRIVED, STARTED)

3. **src/main/java/com/campusconnect/service/RideService.java**
   - Added: getPendingRides(), getActiveRideForRider(), acceptRide(), updateRideStatus()

4. **src/main/java/com/campusconnect/controller/RideController.java**
   - Added: /request endpoint, /active endpoint, /{id}/status endpoint
   - Added: /cancel, /complete, /sos endpoints

5. **src/main/java/com/campusconnect/repository/RideRepository.java**
   - Added: findByStatusOrderByCreatedAtDesc(), findByRiderIdAndStatusIn()

6. **src/main/java/com/campusconnect/controller/DriverController.java**
   - Updated: Accept ride to use ACCEPTED status instead of ACTIVE

### Database Files
1. **database/mysql/schema.sql**
   - Updated: rides table with new columns and status values

2. **database/mysql/migrations/001_update_rides_table.sql**
   - Created: Migration script to update existing database

## Testing Checklist

- [ ] Backend compiles without errors
- [ ] Database migration runs successfully
- [ ] Rider can request a ride through HomeScreen
- [ ] Ride is saved to database with PENDING status
- [ ] Driver can see pending rides on dashboard
- [ ] Driver can accept a ride request
- [ ] Rider receives notification that driver accepted
- [ ] Rider sees driver information on screen
- [ ] Rider can track ride status changes
- [ ] Rider can cancel ride before driver accepts
- [ ] Ride status updates correctly through polling

## Next Steps

1. **Run Database Migration**
   ```bash
   mysql -u root -p campus_connect < database/mysql/migrations/001_update_rides_table.sql
   ```

2. **Restart Backend**
   ```bash
   cd backend
   mvn spring-boot:run
   ```

3. **Test Frontend**
   - Open mobile app
   - Login as rider
   - Request a ride
   - Check admin panel to see ride in database

4. **Test Driver Dashboard**
   - Login as driver
   - Go to driver requests
   - See pending rides
   - Accept a ride request

## Error Handling

The system includes comprehensive error handling:
- Network errors fall back to demo mode
- Invalid ride requests return 400 errors
- Unavailable rides return 404 errors
- Authentication errors redirect to login
- Toast notifications inform user of errors

## Performance Considerations

- Ride status polling occurs every 3 seconds (configurable)
- Database queries are indexed by status and created_at
- Foreign keys ensure referential integrity
- Updated_at column tracks ride changes for auditing
