package com.campusconnect.controller;

import com.campusconnect.dto.RideRequest;
import com.campusconnect.service.RideFaceVerificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/face")
public class RideFaceVerificationController {
    private final RideFaceVerificationService verification;
    private final com.campusconnect.service.DriverRideAcceptanceService drivers;
    public RideFaceVerificationController(RideFaceVerificationService verification, com.campusconnect.service.DriverRideAcceptanceService drivers) { this.verification = verification; this.drivers = drivers; }
    public record ScanRequest(String image, RideRequest ride) {}
    public record DriverScanRequest(String image, Long rideId) {}

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
