// Ride face API: receive a rider or driver scan, call the comparison service and return a
// confirmation for the permitted ride action.
// Where: RideFaceVerificationController handles /api/face; @GetMapping/@PostMapping/@PutMapping
// identify the actions below.
// How: Spring reads request fields/path IDs, invokes these controller methods and returns their
// ResponseEntity. Service/repository/JDBC calls inside the methods perform the actual work.
package com.campusconnect.controller;

import com.campusconnect.dto.RideRequest;
import com.campusconnect.service.RideFaceVerificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

/** Checks the authenticated account and delegates rider or driver face comparisons to the verification service. */
@RestController
@RequestMapping("/api/face")
public class RideFaceVerificationController {
    private final RideFaceVerificationService verification;
    private final com.campusconnect.service.DriverRideAcceptanceService drivers;
    public RideFaceVerificationController(RideFaceVerificationService verification, com.campusconnect.service.DriverRideAcceptanceService drivers) { this.verification = verification; this.drivers = drivers; }
    public record ScanRequest(String image, RideRequest ride) {}
    public record DriverScanRequest(String image, Long rideId) {}

    // Feature: Check driver eligibility and the pending ride before requesting a driver face
    // comparison.
    // Where: RideFaceVerificationController.verifyDriver() below.
    // How: verifyDriver() uses drivers.checkDriver() and checkAvailable(), then
    // verification.verify() with driverAcceptanceDraft(). The client receives the confirmation
    // needed by DriverController.acceptRequest().
    @PostMapping("/verify-driver")
    public ResponseEntity<?> verifyDriver(@RequestBody DriverScanRequest request) {
        try {
            Long userId = Long.valueOf(SecurityContextHolder.getContext().getAuthentication().getName());
            if (request.rideId() == null) throw new IllegalArgumentException("Ride identifier is required");
            drivers.checkDriver(userId); drivers.checkAvailable(request.rideId());
            String token = verification.verify(userId, request.image(), verification.driverAcceptanceDraft(request.rideId(), null));
            return ResponseEntity.ok(Map.of("success", true, "verificationToken", token, "expiresInSeconds", 120));
        } catch (IllegalStateException error) {
            return ResponseEntity.status(503).body(Map.of("error", error.getMessage()));
        } catch (Exception error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage() == null ? "Driver face match failed" : error.getMessage()));
        }
    }

    @PostMapping("/verify-ride")
    public ResponseEntity<?> verify(@RequestBody ScanRequest request) {
        try {
            Long userId = Long.valueOf(SecurityContextHolder.getContext().getAuthentication().getName());
            String token = verification.verify(userId, request.image(), request.ride());
            return ResponseEntity.ok(Map.of("success", true, "verificationToken", token, "expiresInSeconds", 120));
        } catch (IllegalStateException error) {
            return ResponseEntity.status(503).body(Map.of("error", error.getMessage()));
        } catch (Exception error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage() == null ? "Face match failed" : error.getMessage()));
        }
    }
}
