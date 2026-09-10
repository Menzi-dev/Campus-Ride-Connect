package com.campusconnect.controller;

import com.campusconnect.dto.RideRequest;
import com.campusconnect.entity.Ride;
import com.campusconnect.repository.DriverRepository;
import com.campusconnect.repository.UserRepository;
import com.campusconnect.service.RideService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.math.BigDecimal;
import java.math.RoundingMode;

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

    @Autowired
    private JdbcTemplate jdbcTemplate;

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

    @PostMapping("/{id}/rating")
    public ResponseEntity<?> rateDriver(
            @PathVariable Long id,
            @RequestBody Map<String, Object> request) {
        try {
            Long riderId = currentUserId();
            Ride ride = rideService.getRideById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Ride not found"));

            if (!riderId.equals(ride.getRiderId())) {
                return ResponseEntity.status(403).body(Map.of("error", "You cannot rate this ride"));
            }
            if (ride.getStatus() != Ride.RideStatus.COMPLETED) {
                return ResponseEntity.badRequest().body(Map.of("error", "Only completed rides can be rated"));
            }
            if (ride.getDriverId() == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "This ride has no driver to rate"));
            }
            if (ride.getRiderRating() != null) {
                return ResponseEntity.badRequest().body(Map.of("error", "This ride has already been rated"));
            }

            Object rawRating = request.get("rating");
            int rating = rawRating instanceof Number
                    ? ((Number) rawRating).intValue()
                    : Integer.parseInt(String.valueOf(rawRating));
            if (rating < 1 || rating > 5) {
                return ResponseEntity.badRequest().body(Map.of("error", "Rating must be between 1 and 5"));
            }

            ride.setRiderRating(rating);
            Object comment = request.get("comment");
            ride.setRiderRatingComment(comment == null ? null : String.valueOf(comment).trim());
            rideService.saveRide(ride);

            driverRepository.findByUserId(ride.getDriverId()).ifPresent(driver -> {
                int completedRatings = jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM rides WHERE driver_id = ? AND status = 'COMPLETED' AND rider_rating IS NOT NULL",
                        Integer.class,
                        ride.getDriverId());
                BigDecimal currentTotal = driver.getRating() == null
                        ? BigDecimal.ZERO
                        : driver.getRating().multiply(BigDecimal.valueOf(Math.max(0, completedRatings - 1)));
                BigDecimal average = currentTotal.add(BigDecimal.valueOf(rating))
                        .divide(BigDecimal.valueOf(completedRatings), 2, RoundingMode.HALF_UP);
                driver.setRating(average);
                driverRepository.save(driver);
            });

            return ResponseEntity.ok(Map.of("success", true, "rating", rating));
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Rating must be a number from 1 to 5"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
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