package com.campusconnect.service;

import com.campusconnect.entity.Driver;
import com.campusconnect.entity.Ride;
import com.campusconnect.entity.User;
import com.campusconnect.repository.DriverRepository;
import com.campusconnect.repository.RideRepository;
import com.campusconnect.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Service
public class DriverRideAcceptanceService {
    private final RideRepository rides;
    private final DriverRepository drivers;
    private final UserRepository users;
    private final RideFaceVerificationService faces;
    public DriverRideAcceptanceService(RideRepository rides, DriverRepository drivers,
            UserRepository users, RideFaceVerificationService faces) {
        this.rides = rides; this.drivers = drivers; this.users = users; this.faces = faces;
    }
    public void checkDriver(Long userId) {
        var user = users.findById(userId).orElseThrow(() -> new IllegalArgumentException("Driver account not found"));
        if (user.getRole() != User.Role.DRIVER) throw new IllegalArgumentException("Only drivers can accept rides");
        var driver = drivers.findByUserId(userId).orElseThrow(() -> new IllegalArgumentException("Driver profile not found"));
        if (driver.getApprovalStatus() != Driver.ApprovalStatus.APPROVED)
            throw new IllegalArgumentException("Your driver account must be approved before accepting rides");
    }
    public void checkAvailable(Long rideId) {
        checkPending(rides.findById(rideId).orElseThrow(() -> new IllegalArgumentException("Ride request not found")));
    }
    private void checkPending(Ride ride) {
        if (ride.getStatus() != Ride.RideStatus.PENDING || ride.getDriverId() != null || ride.getFaceMatchedAt() == null)
            throw new IllegalArgumentException("This ride request is no longer available");
    }
    @Transactional
    public Ride accept(Long userId, Long rideId, String token) {
        checkDriver(userId);
        Ride ride = rides.findLockedById(rideId).orElseThrow(() -> new IllegalArgumentException("Ride request not found"));
        // A lost-response retry returns this driver's previously verified acceptance.
        if (userId.equals(ride.getDriverId()) && ride.getDriverFaceMatchedAt() != null
                && ride.getStatus() != Ride.RideStatus.PENDING && ride.getStatus() != Ride.RideStatus.CANCELLED)
            return ride;
        checkPending(ride);
        var receipt = faces.consume(userId, faces.driverAcceptanceDraft(rideId, token));
        ride.setDriverId(userId);
        ride.setDriverFaceMatchedAt(LocalDateTime.ofInstant(receipt.matchedAt(), ZoneOffset.UTC));
        ride.setStatus(Ride.RideStatus.ACCEPTED);
        return rides.save(ride);
    }
}
