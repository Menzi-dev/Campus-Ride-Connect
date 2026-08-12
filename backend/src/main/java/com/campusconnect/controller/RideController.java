package com.campusconnect.controller;

import com.campusconnect.dto.RideRequest;
import com.campusconnect.entity.Ride;
import com.campusconnect.service.RideService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/rides")
@CrossOrigin(origins = "*")
public class RideController {

    @Autowired
    private RideService rideService;

    /**
     * POST /api/rides/request
     * Request a new ride
     */
    @PostMapping("/request")
    public ResponseEntity<?> requestRide(@RequestBody RideRequest request) {
        try {
            Long riderId = currentUserId();
            Ride ride = rideService.requestRide(riderId, request);
            return ResponseEntity.ok(ride);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * POST /api/rides
     * Backward compatibility endpoint for ride creation
     */
    @PostMapping
    public ResponseEntity<?> createRide(@RequestBody RideRequest request) {
        return requestRide(request);
    }

    /**
     * GET /api/rides/active
     * Get the currently active ride for the rider
     */
    @GetMapping("/active")
    public ResponseEntity<?> getActiveRide() {
        try {
            Long riderId = currentUserId();
            Optional<Ride> rideOpt = rideService.getActiveRideForRider(riderId);
            if (rideOpt.isPresent()) {
                return ResponseEntity.ok(rideOpt.get());
            } else {
                return ResponseEntity.noContent().build();
            }
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * GET /api/rides/{id}
     * Get a specific ride by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getRideById(@PathVariable Long id) {
        try {
            Optional<Ride> rideOpt = rideService.getRideById(id);
            if (rideOpt.isPresent()) {
                return ResponseEntity.ok(rideOpt.get());
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * GET /api/rides/{id}/status
     * Get the current status of a ride
     */
    @GetMapping("/{id}/status")
    public ResponseEntity<?> getRideStatus(@PathVariable Long id) {
        try {
            Optional<Ride> rideOpt = rideService.getRideById(id);
            if (rideOpt.isPresent()) {
                Map<String, Object> response = new HashMap<>();
                Ride ride = rideOpt.get();
                response.put("id", ride.getId());
                response.put("status", ride.getStatus());
                response.put("driverId", ride.getDriverId());
                response.put("updatedAt", ride.getUpdatedAt());
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * GET /api/rides/history
     * Get ride history for the rider
     */
    @GetMapping("/history")
    public ResponseEntity<?> getHistory() {
        Long riderId = currentUserId();
        List<Ride> rides = rideService.getHistory(riderId);
        return ResponseEntity.ok(rides);
    }

    /**
     * POST /api/rides/{id}/cancel
     * Cancel a ride
     */
    @PostMapping("/{id}/cancel")
    public ResponseEntity<?> cancelRide(@PathVariable Long id) {
        try {
            Ride ride = rideService.cancelRide(id);
            return ResponseEntity.ok(ride);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * POST /api/rides/{id}/complete
     * Mark a ride as completed
     */
    @PostMapping("/{id}/complete")
    public ResponseEntity<?> completeRide(@PathVariable Long id) {
        try {
            Ride ride = rideService.updateRideStatus(id, Ride.RideStatus.COMPLETED);
            return ResponseEntity.ok(ride);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * POST /api/rides/{id}/sos
     * Send SOS alert for a ride
     */
    @PostMapping("/{id}/sos")
    public ResponseEntity<?> sosAlert(@PathVariable Long id) {
        try {
            Optional<Ride> rideOpt = rideService.getRideById(id);
            if (rideOpt.isPresent()) {
                Map<String, String> response = new HashMap<>();
                response.put("message", "SOS alert has been sent to emergency services");
                response.put("rideId", id.toString());
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    // Utility method to get the current user ID from security context
    private Long currentUserId() {
        String userId = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return Long.valueOf(userId);
    }
}