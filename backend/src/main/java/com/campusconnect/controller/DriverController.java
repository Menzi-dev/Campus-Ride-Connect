package com.campusconnect.controller;

import com.campusconnect.entity.Driver;
import com.campusconnect.entity.Ride;
import com.campusconnect.entity.User;
import com.campusconnect.repository.DriverRepository;
import com.campusconnect.repository.RideRepository;
import com.campusconnect.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

@RestController
@RequestMapping("/api/driver")
@CrossOrigin(origins = "*")
public class DriverController {

    private static final Logger LOGGER = LoggerFactory.getLogger(DriverController.class);

    @Autowired
    private DriverRepository driverRepository;

    @Autowired
    private RideRepository rideRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private Long currentUserId() {
        String userId = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return Long.valueOf(userId);
    }

    /**
     * GET /api/driver/stats
     * Returns driver statistics: todayRides, earnings, rating, totalRides, online status
     */
    @GetMapping("/stats")
    public ResponseEntity<?> getDriverStats() {
        try {
            Long userId = currentUserId();
            
            // Get driver info
            Optional<Driver> driverOpt = driverRepository.findByUserId(userId);
            if (driverOpt.isEmpty()) {
                Map<String, Object> stats = new LinkedHashMap<>();
                stats.put("todayRides", 0);
                stats.put("earnings", 0.0);
                stats.put("rating", 0.0);
                stats.put("totalRides", 0);
                stats.put("online", false);
                return ResponseEntity.ok(stats);
            }

            Driver driver = driverOpt.get();

            // Get today's completed rides
            LocalDateTime startOfDay = LocalDateTime.of(LocalDate.now(), LocalTime.MIN);
            LocalDateTime endOfDay = LocalDateTime.of(LocalDate.now(), LocalTime.MAX);
            
            String todayRidesSql = "SELECT COUNT(*) FROM rides WHERE driver_id = ? AND status = 'COMPLETED' AND created_at BETWEEN ? AND ?";
            Integer todayRides = jdbcTemplate.queryForObject(
                todayRidesSql,
                new Object[]{userId, startOfDay, endOfDay},
                Integer.class
            );

            // Get today's earnings
            String earningsSql = "SELECT COALESCE(SUM(fare), 0) FROM rides WHERE driver_id = ? AND status = 'COMPLETED' AND created_at BETWEEN ? AND ?";
            BigDecimal earnings = jdbcTemplate.queryForObject(
                earningsSql,
                new Object[]{userId, startOfDay, endOfDay},
                BigDecimal.class
            );

            // Get total rides
            String totalRidesSql = "SELECT COUNT(*) FROM rides WHERE driver_id = ? AND status = 'COMPLETED'";
            Integer totalRides = jdbcTemplate.queryForObject(
                totalRidesSql,
                new Object[]{userId},
                Integer.class
            );

            // Get user's online status (if stored in users table)
            Optional<User> userOpt = userRepository.findById(userId);
            boolean isOnline = userOpt.isPresent() && userOpt.get().getFaceVerified() != null; // placeholder

            Map<String, Object> stats = new LinkedHashMap<>();
            stats.put("todayRides", todayRides != null ? todayRides : 0);
            stats.put("earnings", earnings != null ? earnings.doubleValue() : 0.0);
            stats.put("rating", 4.9); // TODO: Calculate from ride ratings
            stats.put("totalRides", totalRides != null ? totalRides : 0);
            stats.put("online", isOnline);

            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            LOGGER.error("Error getting driver stats", e);
            Map<String, Object> stats = new LinkedHashMap<>();
            stats.put("todayRides", 0);
            stats.put("earnings", 0.0);
            stats.put("rating", 0.0);
            stats.put("totalRides", 0);
            stats.put("online", false);
            return ResponseEntity.ok(stats);
        }
    }

    /**
     * GET /api/driver/requests
     * Returns pending ride requests (PENDING status in rides table where driver_id is NULL)
     */
    @GetMapping("/requests")
    public ResponseEntity<?> getDriverRequests() {
        try {
            Long driverId = currentUserId();

            // Get all PENDING rides that haven't been assigned to a driver
            String sql = "SELECT r.id, r.rider_id, r.pickup_location, r.destination, r.fare, r.distance_km, " +
                    "r.created_at, u.full_name, u.phone " +
                    "FROM rides r " +
                    "LEFT JOIN users u ON u.user_id = r.rider_id " +
                    "WHERE r.status = 'PENDING' AND r.driver_id IS NULL " +
                    "ORDER BY r.created_at DESC";

            List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);
            List<Map<String, Object>> requests = new ArrayList<>();

            for (Map<String, Object> row : rows) {
                Map<String, Object> request = new LinkedHashMap<>();
                request.put("id", String.valueOf(row.get("id")));
                request.put("riderName", row.get("full_name"));
                
                String fullName = (String) row.get("full_name");
                String[] names = fullName != null ? fullName.split(" ") : new String[]{""};
                String initials = String.valueOf(names.length > 0 ? names[0].charAt(0) : '?') +
                                 (names.length > 1 ? names[names.length - 1].charAt(0) : "");
                request.put("riderInitials", initials);
                
                request.put("pickup", row.get("pickup_location"));
                request.put("destination", row.get("destination"));
                
                BigDecimal fare = (BigDecimal) row.get("fare");
                request.put("fare", "R " + (fare != null ? fare.setScale(2, java.math.RoundingMode.HALF_UP) : "0.00"));
                
                Double distance = (Double) row.get("distance_km");
                request.put("distance", distance != null ? String.format("%.1f km", distance) : "N/A");
                
                request.put("status", "pending");

                requests.add(request);
            }

            return ResponseEntity.ok(requests);
        } catch (Exception e) {
            LOGGER.error("Error getting driver requests", e);
            return ResponseEntity.ok(new ArrayList<>());
        }
    }

    /**
     * POST /api/driver/online
     * Updates driver online status
     */
    @PostMapping("/online")
    public ResponseEntity<?> setOnlineStatus(@RequestBody Map<String, Boolean> request) {
        try {
            Long userId = currentUserId();
            boolean online = request.getOrDefault("online", false);

            // TODO: Store online status in database (add column to users or drivers table)
            // For now, just return success

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", true);
            response.put("online", online);
            response.put("message", online ? "Driver is now online" : "Driver is now offline");

            LOGGER.info("Driver " + userId + " set online status to: " + online);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            LOGGER.error("Error setting online status", e);
            Map<String, String> error = new LinkedHashMap<>();
            error.put("success", "false");
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * POST /api/driver/requests/{id}/accept
     * Driver accepts a ride request
     */
    @PostMapping("/requests/{id}/accept")
    public ResponseEntity<?> acceptRequest(@PathVariable("id") Long rideId) {
        try {
            Long driverId = currentUserId();

            Optional<Ride> rideOpt = rideRepository.findById(rideId);
            if (rideOpt.isEmpty()) {
                Map<String, String> error = new LinkedHashMap<>();
                error.put("error", "Ride request not found");
                return ResponseEntity.status(404).body(error);
            }

            Ride ride = rideOpt.get();
            
            // Check if ride is still available (PENDING and no driver assigned)
            if (!ride.getStatus().equals(Ride.RideStatus.PENDING) || ride.getDriverId() != null) {
                Map<String, String> error = new LinkedHashMap<>();
                error.put("error", "Ride request is no longer available");
                return ResponseEntity.status(400).body(error);
            }

            // Assign driver and set ride as ACCEPTED
            ride.setDriverId(driverId);
            ride.setStatus(Ride.RideStatus.ACCEPTED);
            ride.setUpdatedAt(java.time.LocalDateTime.now());
            rideRepository.save(ride);

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", true);
            response.put("message", "Ride accepted");
            response.put("ride", ride);

            LOGGER.info("Driver " + driverId + " accepted ride " + rideId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            LOGGER.error("Error accepting request", e);
            Map<String, String> error = new LinkedHashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * POST /api/driver/requests/{id}/decline
     * Driver declines a ride request
     */
    @PostMapping("/requests/{id}/decline")
    public ResponseEntity<?> declineRequest(@PathVariable("id") Long rideId) {
        try {
            Long driverId = currentUserId();

            Optional<Ride> rideOpt = rideRepository.findById(rideId);
            if (rideOpt.isEmpty()) {
                Map<String, String> error = new LinkedHashMap<>();
                error.put("error", "Ride request not found");
                return ResponseEntity.status(404).body(error);
            }

            Ride ride = rideOpt.get();
            
            // Check if ride is still available (PENDING and no driver assigned)
            if (!ride.getStatus().equals(Ride.RideStatus.PENDING) || ride.getDriverId() != null) {
                Map<String, String> error = new LinkedHashMap<>();
                error.put("error", "Ride request is no longer available");
                return ResponseEntity.status(400).body(error);
            }

            // Just log the decline - the ride remains PENDING for other drivers
            // In a production system, you might track declined requests to avoid showing them repeatedly

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", true);
            response.put("message", "Ride request declined");

            LOGGER.info("Driver " + driverId + " declined ride " + rideId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            LOGGER.error("Error declining request", e);
            Map<String, String> error = new LinkedHashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
}
