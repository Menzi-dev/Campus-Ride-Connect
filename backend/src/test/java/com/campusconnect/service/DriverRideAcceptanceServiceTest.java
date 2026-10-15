// Test feature: check driver ride acceptance service behaviour using the cases below. Use the
// fixtures and any mocked dependencies defined here to exercise success and failure cases.
// Where: DriverRideAcceptanceServiceTest in this file, including prepare() and
// failureDoesNotAssignRide().
// How: JUnit executes the test methods. Fixtures and any Mockito mocks in this class provide
// controlled inputs; assertions check the returned values, errors or saved interactions.
package com.campusconnect.service;

import com.campusconnect.entity.*;
import com.campusconnect.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DriverRideAcceptanceServiceTest {
    private final RideRepository rides = mock(RideRepository.class);
    private final DriverRepository drivers = mock(DriverRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final RideFaceVerificationService faces = mock(RideFaceVerificationService.class);
    private final DriverRideAcceptanceService service = new DriverRideAcceptanceService(rides, drivers, users, faces);
    private Ride ride;
    @BeforeEach void prepare() {
        var user = new User(); user.setRole(User.Role.DRIVER);
        var driver = new Driver(); driver.setApprovalStatus(Driver.ApprovalStatus.APPROVED);
        when(users.findById(7L)).thenReturn(Optional.of(user));
        when(drivers.findByUserId(7L)).thenReturn(Optional.of(driver));
        ride = new Ride(); ride.setId(42L); ride.setStatus(Ride.RideStatus.PENDING); ride.setFaceMatchedAt(LocalDateTime.now());
        when(rides.findLockedById(42L)).thenReturn(Optional.of(ride));
    }
    @Test void failureDoesNotAssignRide() {
        when(faces.consume(eq(7L), any())).thenThrow(new IllegalArgumentException("Face confirmation required"));
        assertThrows(IllegalArgumentException.class, () -> service.accept(7L, 42L, null));
        assertNull(ride.getDriverId()); assertEquals(Ride.RideStatus.PENDING, ride.getStatus());
        verify(rides, never()).save(any());
    }
    @Test void successAssignsDriverAndRecordsMatch() {
        when(faces.consume(eq(7L), any())).thenReturn(new RideFaceVerificationService.Receipt(7L, "driver", Instant.now().plusSeconds(60), Instant.now(), .9));
        when(rides.save(ride)).thenReturn(ride);
        assertSame(ride, service.accept(7L, 42L, "proof"));
        assertEquals(7L, ride.getDriverId()); assertNotNull(ride.getDriverFaceMatchedAt());
        assertEquals(Ride.RideStatus.ACCEPTED, ride.getStatus());
    }
    @Test void anotherDriverClaimingRideDuringScanPreventsAssignment() {
        ride.setDriverId(9L); ride.setStatus(Ride.RideStatus.ACCEPTED);
        assertThrows(IllegalArgumentException.class, () -> service.accept(7L, 42L, "proof"));
        assertEquals(9L, ride.getDriverId()); verifyNoInteractions(faces);
    }
    @Test void retryReturnsPreviouslyVerifiedAcceptance() {
        ride.setDriverId(7L); ride.setStatus(Ride.RideStatus.ACCEPTED); ride.setDriverFaceMatchedAt(LocalDateTime.now());
        assertSame(ride, service.accept(7L, 42L, "proof")); verifyNoInteractions(faces);
        verify(rides, never()).save(any());
    }
    @Test void riderCannotAcceptAsDriver() {
        var user = new User(); user.setRole(User.Role.RIDER); when(users.findById(7L)).thenReturn(Optional.of(user));
        assertThrows(IllegalArgumentException.class, () -> service.accept(7L, 42L, "proof")); verifyNoInteractions(rides, faces);
    }
}
