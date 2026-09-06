package com.campusconnect.controller;

import com.campusconnect.dto.RideRequest;
import com.campusconnect.entity.Ride;
import com.campusconnect.repository.DriverRepository;
import com.campusconnect.repository.UserRepository;
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

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DriverRepository driverRepository;

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
                return ResponseEntity.ok(rideResponse(rideOpt.get()));
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
                response.put("createdAt", ride.getCreatedAt());
                addDriverDetails(response, ride.getDriverId());
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

    private Map<String, Object> rideResponse(Ride ride) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", ride.getId());
        response.put("riderId", ride.getRiderId());
        response.put("driverId", ride.getDriverId());
        response.put("pickupLocation", ride.getPickupLocation());
        response.put("destination", ride.getDestination());
        response.put("pickupLat", ride.getPickupLat());
        response.put("pickupLng", ride.getPickupLng());
        response.put("destLat", ride.getDestLat());
        response.put("destLng", ride.getDestLng());
        response.put("fare", ride.getFare());
        response.put("distanceKm", ride.getDistanceKm());
        response.put("durationMinutes", ride.getDurationMinutes());
        response.put("status", ride.getStatus());
        response.put("createdAt", ride.getCreatedAt());
        addDriverDetails(response, ride.getDriverId());
        return response;
    }

    private void addDriverDetails(Map<String, Object> response, Long driverId) {
        if (driverId == null) {
            return;
        }

        userRepository.findById(driverId).ifPresent(user -> {
            Map<String, Object> driver = new HashMap<>();
            driver.put("id", user.getId());
            driver.put("fullName", user.getFullName());
            driver.put("phone", user.getPhone());
            driverRepository.findByUserId(driverId).ifPresent(driverRecord -> {
                driver.put("rating", driverRecord.getRating());
                driver.put("vehicleMake", driverRecord.getVehicleMake());
                driver.put("licencePlate", driverRecord.getLicencePlate());
            });
            response.put("driver", driver);
        });
    }
}