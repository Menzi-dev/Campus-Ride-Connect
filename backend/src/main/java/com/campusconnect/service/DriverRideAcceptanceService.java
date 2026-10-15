// Driver assignment rules: require an approved driver and matching face confirmation, lock the
// request and save the assignment only while the ride is available.
// Where: DriverRideAcceptanceService, starting with checkDriver() and accept() in this file.
// How: checkDriver() reads users.findById() and drivers.findByUserId(), then checks
// User.Role.DRIVER and Driver.ApprovalStatus.APPROVED. A missing or ineligible account throws an
// error.
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

/** Checks driver approval and consumes ride-specific face confirmation while locking the request for assignment. */
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
    // Feature: Reject acceptance unless the signed-in account is a driver with an approved profile.
    // Where: DriverRideAcceptanceService.checkDriver() below.
    // How: checkDriver() reads users.findById() and drivers.findByUserId(), then checks
    // User.Role.DRIVER and Driver.ApprovalStatus.APPROVED. A missing or ineligible account throws
    // an error.
    public void checkDriver(Long userId) {
        var user = users.findById(userId).orElseThrow(() -> new IllegalArgumentException("Driver account not found"));
        if (user.getRole() != User.Role.DRIVER) throw new IllegalArgumentException("Only drivers can accept rides");
        var driver = drivers.findByUserId(userId).orElseThrow(() -> new IllegalArgumentException("Driver profile not found"));
        if (driver.getApprovalStatus() != Driver.ApprovalStatus.APPROVED)
            throw new IllegalArgumentException("Your driver account must be approved before accepting rides");
    }
    // Feature: Find the ride and run the pending-request checks before starting acceptance.
    // Where: DriverRideAcceptanceService.checkAvailable() below.
    // How: checkAvailable() loads rides.findById(rideId) and passes the result to checkPending() in
    // this class.
    public void checkAvailable(Long rideId) {
        checkPending(rides.findById(rideId).orElseThrow(() -> new IllegalArgumentException("Ride request not found")));
    }
    // Feature: Require a pending, unassigned ride with a rider face-check record.
    // Where: DriverRideAcceptanceService.checkPending() below.
    // How: checkPending() checks getStatus(), getDriverId() and getFaceMatchedAt() on the Ride. Any
    // non-pending, assigned or unverified request is rejected.
    private void checkPending(Ride ride) {
        if (ride.getStatus() != Ride.RideStatus.PENDING || ride.getDriverId() != null || ride.getFaceMatchedAt() == null)
            throw new IllegalArgumentException("This ride request is no longer available");
    }
    // Feature: Lock the ride while checking and saving acceptance. An exact retry by its already
    // verified driver returns the existing assignment.
    // Where: DriverRideAcceptanceService.accept() below.
    // How: accept() calls RideRepository.findLockedById() inside @Transactional to hold a write
    // lock. faces.consume() checks the ride-bound confirmation; setDriverId(),
    // setDriverFaceMatchedAt() and setStatus(ACCEPTED) prepare the record saved by rides.save().
    @Transactional
    public Ride accept(Long userId, Long rideId, String token) {
        checkDriver(userId);
        // Lock the request until commit so two drivers cannot accept the same ride.
        Ride ride = rides.findLockedById(rideId).orElseThrow(() -> new IllegalArgumentException("Ride request not found"));
        // A lost-response retry returns this driver's previously verified acceptance.
        if (userId.equals(ride.getDriverId()) && ride.getDriverFaceMatchedAt() != null
                && ride.getStatus() != Ride.RideStatus.PENDING && ride.getStatus() != Ride.RideStatus.CANCELLED)
            return ride;
        checkPending(ride);
        // The receipt must belong to this driver and this particular ride request.
        var receipt = faces.consume(userId, faces.driverAcceptanceDraft(rideId, token));
        ride.setDriverId(userId);
        ride.setDriverFaceMatchedAt(LocalDateTime.ofInstant(receipt.matchedAt(), ZoneOffset.UTC));
        ride.setStatus(Ride.RideStatus.ACCEPTED);
        return rides.save(ride);
    }
}
