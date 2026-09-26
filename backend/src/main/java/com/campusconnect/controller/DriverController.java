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
            Optional<Driver> driverOpt = findOrCreateDriverProfile(userId);
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
            // rides.driver_id stores users.user_id, not drivers.driver_id.
            Long driverId = userId;

            LocalDateTime startOfDay = LocalDateTime.of(LocalDate.now(), LocalTime.MIN);
            LocalDateTime endOfDay = LocalDateTime.of(LocalDate.now(), LocalTime.MAX);
                    Long todayRides = 0L;
                    BigDecimal earnings = BigDecimal.ZERO;
                    Long completedRideCount = 0L;
                    try {
                    todayRides = jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM rides WHERE driver_id = ? AND status = 'COMPLETED' "
                            + "AND updated_at BETWEEN ? AND ?",
                        Long.class, driverId, startOfDay, endOfDay);
                    } catch (Exception e) {
                    LOGGER.warn("Could not calculate today's completed rides using updated_at; falling back to created_at", e);
                        try {
                            todayRides = jdbcTemplate.queryForObject(
                                "SELECT COUNT(*) FROM rides WHERE driver_id = ? AND status = 'COMPLETED' "
                                    + "AND created_at BETWEEN ? AND ?",
                                Long.class, driverId, startOfDay, endOfDay);
                        } catch (Exception fallback) {
                            LOGGER.warn("Could not calculate today's completed rides using created_at", fallback);
                            todayRides = 0L;
                        }
                    }
                    try {
                    earnings = jdbcTemplate.queryForObject(
                        "SELECT COALESCE(SUM(fare), 0) FROM rides WHERE driver_id = ? AND status = 'COMPLETED'",
                        BigDecimal.class, driverId);
                    } catch (Exception e) {
                    LOGGER.warn("Could not calculate driver earnings", e);
                    }
                    try {
                    completedRideCount = jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM rides WHERE driver_id = ? AND status = 'COMPLETED'",
                        Long.class, driverId);
                    } catch (Exception e) {
                    LOGGER.warn("Could not calculate total completed rides", e);
                    }
                int totalRides = Math.max(
                    completedRideCount == null ? 0 : completedRideCount.intValue(),
                    driver.getTotalTrips() == null ? 0 : driver.getTotalTrips());

            Map<String, Object> stats = new LinkedHashMap<>();
            stats.put("todayRides", todayRides == null ? 0 : todayRides);
            stats.put("earnings", earnings == null ? 0.0 : earnings.doubleValue());
            stats.put("rating", driver.getRating() != null ? driver.getRating().doubleValue() : 0.0);
            stats.put("totalRides", totalRides);
            stats.put("online", driver.isOnline());

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

    @GetMapping("/earnings")
    public ResponseEntity<?> getDriverEarnings() {
        Long driverId = currentUserId();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("thisWeek", earningsForWeek(driverId, 0));
        response.put("lastWeek", earningsForWeek(driverId, 1));
        BigDecimal totalAmount = jdbcTemplate.queryForObject(
            "SELECT COALESCE(SUM(fare), 0) FROM rides WHERE driver_id = ? AND status = 'COMPLETED'",
            BigDecimal.class, driverId);
        response.put("total", totalAmount == null ? "0" : totalAmount.toPlainString());
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "SELECT DATE_FORMAT(COALESCE(completed_at, updated_at, created_at), '%Y-%m') AS month, " +
                "COALESCE(SUM(fare), 0) AS amount, COUNT(*) AS rides " +
                "FROM rides WHERE driver_id = ? AND status = 'COMPLETED' " +
                "GROUP BY DATE_FORMAT(COALESCE(completed_at, updated_at, created_at), '%Y-%m') " +
                "ORDER BY month DESC", driverId);
        rows.forEach(row -> {
            Object amount = row.get("amount");
            if (amount != null) row.put("amount", amount.toString());
        });
        response.put("months", rows);
        return ResponseEntity.ok(response);
    }

    private Map<String, Object> earningsForWeek(Long driverId, int weeksAgo) {
        Map<String, Object> result = new LinkedHashMap<>();
        BigDecimal amount = jdbcTemplate.queryForObject(
            "SELECT COALESCE(SUM(fare), 0) FROM rides WHERE driver_id = ? AND status = 'COMPLETED' " +
                "AND YEARWEEK(COALESCE(completed_at, updated_at, created_at), 1) = YEARWEEK(CURDATE(), 1) - ?",
            BigDecimal.class, driverId, weeksAgo);
        Long rides = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM rides WHERE driver_id = ? AND status = 'COMPLETED' " +
                "AND YEARWEEK(COALESCE(completed_at, updated_at, created_at), 1) = YEARWEEK(CURDATE(), 1) - ?",
            Long.class, driverId, weeksAgo);
        result.put("amount", amount == null ? "0" : amount.toPlainString());
        result.put("rides", rides == null ? 0 : rides);
        return result;
    }

    @GetMapping("/history")
    public ResponseEntity<?> getDriverHistory() {
        Long driverId = currentUserId();
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "SELECT r.ride_id AS id, r.pickup_location AS pickup, r.destination, r.fare, " +
                "COALESCE(r.completed_at, r.updated_at, r.created_at) AS completedAt, " +
                "u.full_name AS riderName FROM rides r LEFT JOIN users u ON u.user_id = r.rider_id " +
                "WHERE r.driver_id = ? AND r.status = 'COMPLETED' " +
                "ORDER BY COALESCE(r.completed_at, r.updated_at, r.created_at) DESC", driverId);
            rows.forEach(row -> {
                Object fare = row.get("fare");
                if (fare != null) row.put("fare", fare.toString());
            });
            return ResponseEntity.ok(rows);
    }

    @GetMapping("/profile")
    public ResponseEntity<?> getDriverProfile() {
        Long userId = currentUserId();
        Optional<User> user = userRepository.findById(userId);
        Optional<Driver> driver = driverRepository.findByUserId(userId);
        if (user.isEmpty()) return ResponseEntity.notFound().build();
        Map<String, Object> profile = new LinkedHashMap<>();
        User account = user.get();
        profile.put("fullName", account.getFullName());
        profile.put("email", account.getEmail());
        profile.put("phone", account.getPhone());
        profile.put("faceVerified", Boolean.TRUE.equals(account.getFaceVerified()));
        driver.ifPresent(value -> {
            profile.put("rating", value.getRating());
            Long completedTrips = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM rides WHERE driver_id = ? AND status = 'COMPLETED'", Long.class, userId);
            profile.put("totalTrips", completedTrips == null ? 0 : completedTrips);
            profile.put("approvalStatus", value.getApprovalStatus());
            profile.put("licencePlate", value.getLicencePlate() != null ? value.getLicencePlate() : account.getLicencePlate());
            profile.put("vehicleMake", value.getVehicleMake() != null ? value.getVehicleMake() : account.getVehicleMake());
            profile.put("vehicleYear", value.getVehicleYear() != null ? value.getVehicleYear() : account.getVehicleYear());
            profile.put("vehiclePhoto", value.getVehiclePhoto());
        });
        return ResponseEntity.ok(profile);
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
            String sql = "SELECT r.ride_id AS id, r.rider_id, r.pickup_location, r.destination, r.fare, r.distance_km, " +
                    "r.created_at, u.full_name, u.phone " +
                    "FROM rides r " +
                    "LEFT JOIN users u ON u.user_id = r.rider_id " +
                    "WHERE r.status = 'PENDING' AND r.driver_id IS NULL " +
                    "AND EXISTS (SELECT 1 FROM payments p WHERE p.ride_id = r.ride_id AND p.status IN ('PENDING', 'COMPLETED')) " +
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
     * GET /api/driver/requests/{id}
     * Returns details of a specific PENDING ride request (before driver accepts it)
     */
    @GetMapping("/requests/{id}")
    public ResponseEntity<?> getRideRequestDetails(@PathVariable("id") Long rideId) {
        try {
            Optional<Ride> rideOpt = rideRepository.findById(rideId);
            
            if (rideOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "Ride request not found"));
            }

            Ride ride = rideOpt.get();
            
            // Only return details if ride is PENDING (hasn't been accepted yet)
            if (!ride.getStatus().equals(Ride.RideStatus.PENDING)) {
                return ResponseEntity.status(404).body(Map.of("error", "This ride request is no longer available"));
            }

            // Get rider information
            Optional<User> riderOpt = userRepository.findById(ride.getRiderId());
            if (riderOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "Rider not found"));
            }

            User rider = riderOpt.get();
            String fullName = rider.getFullName() != null ? rider.getFullName() : "Unknown";
            String[] names = fullName.split(" ");
            String initials = String.valueOf(names.length > 0 ? names[0].charAt(0) : '?') +
                             (names.length > 1 ? names[names.length - 1].charAt(0) : "");

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("id", ride.getId());
            response.put("riderName", fullName);
            response.put("riderInitials", initials);
            response.put("riderRating", 4.8); // TODO: Calculate from ride ratings
            response.put("riderPhone", rider.getPhone());
            response.put("pickup", ride.getPickupLocation());
            response.put("destination", ride.getDestination());
            response.put("pickupLat", ride.getPickupLat() != null ? ride.getPickupLat() : -28.7587766);
            response.put("pickupLng", ride.getPickupLng() != null ? ride.getPickupLng() : 24.759741);
            response.put("destLat", ride.getDestLat() != null ? ride.getDestLat() : -28.7600000);
            response.put("destLng", ride.getDestLng() != null ? ride.getDestLng() : 24.7600000);
            response.put("fare", ride.getFare() != null ? "R " + ride.getFare().setScale(2, java.math.RoundingMode.HALF_UP) : "R 0.00");
            response.put("distance", ride.getDistanceKm() != null ? String.format("%.1f km", ride.getDistanceKm()) : "N/A");
            response.put("estimatedTime", ride.getDurationMinutes() != null ? String.format("%.0f mins", ride.getDurationMinutes()) : "N/A");
            response.put("notes", "");
            response.put("status", "pending");

            LOGGER.info("Fetching ride request details for ride " + rideId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            LOGGER.error("Error fetching ride request details", e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/rides/{id}")
    public ResponseEntity<?> getAssignedRide(@PathVariable("id") Long rideId) {
        try {
            Long driverId = currentUserId();
            Optional<Ride> rideOpt = rideRepository.findById(rideId);
            if (rideOpt.isEmpty() || !driverId.equals(rideOpt.get().getDriverId())) {
                return ResponseEntity.status(404).body(Map.of("error", "Assigned ride not found"));
            }
            Ride ride = rideOpt.get();
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("id", ride.getId());
            response.put("status", ride.getStatus());
            response.put("pickupLocation", ride.getPickupLocation());
            response.put("destination", ride.getDestination());
            response.put("pickupLat", ride.getPickupLat());
            response.put("pickupLng", ride.getPickupLng());
            response.put("destLat", ride.getDestLat());
            response.put("destLng", ride.getDestLng());
            response.put("fare", ride.getFare());
            userRepository.findById(ride.getRiderId()).ifPresent(rider -> {
                response.put("riderId", rider.getId());
                response.put("riderName", rider.getFullName());
                response.put("riderPhone", rider.getPhone());
            });
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            LOGGER.error("Error loading assigned ride", e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/rides/{id}/status")
    public ResponseEntity<?> updateAssignedRideStatus(
            @PathVariable("id") Long rideId,
            @RequestBody Map<String, String> request) {
        try {
            Long driverId = currentUserId();
            Optional<Ride> rideOpt = rideRepository.findById(rideId);
            if (rideOpt.isEmpty() || !driverId.equals(rideOpt.get().getDriverId())) {
                return ResponseEntity.status(404).body(Map.of("error", "Assigned ride not found"));
            }

            Ride.RideStatus nextStatus = Ride.RideStatus.valueOf(request.getOrDefault("status", "").toUpperCase());
            if (nextStatus != Ride.RideStatus.ARRIVED
                    && nextStatus != Ride.RideStatus.STARTED
                    && nextStatus != Ride.RideStatus.COMPLETED) {
                return ResponseEntity.badRequest().body(Map.of("error", "Unsupported driver ride status"));
            }

            Ride ride = rideOpt.get();

            Ride.RideStatus currentStatus = ride.getStatus();
            boolean validTransition = (currentStatus == Ride.RideStatus.ACCEPTED || currentStatus == Ride.RideStatus.ENROUTE)
                    && nextStatus == Ride.RideStatus.ARRIVED
                || currentStatus == Ride.RideStatus.ARRIVED && nextStatus == Ride.RideStatus.STARTED
                || currentStatus == Ride.RideStatus.STARTED && nextStatus == Ride.RideStatus.COMPLETED;
            if (!validTransition) {
                return ResponseEntity.badRequest().body(Map.of(
                    "error", "Invalid ride transition",
                    "currentStatus", currentStatus.name(),
                    "requestedStatus", nextStatus.name()
                ));
            }

            ride.setStatus(nextStatus);
            if (nextStatus == Ride.RideStatus.STARTED) {
                ride.setStartedAt(LocalDateTime.now());
            }
            if (nextStatus == Ride.RideStatus.COMPLETED) {
                ride.setCompletedAt(LocalDateTime.now());
                Driver driver = driverRepository.findByUserId(driverId).orElse(null);
                if (driver != null) {
                    driver.setTotalTrips((driver.getTotalTrips() == null ? 0 : driver.getTotalTrips()) + 1);
                    driverRepository.save(driver);
                }
            }
            return ResponseEntity.ok(rideRepository.save(ride));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid ride status"));
        } catch (Exception e) {
            LOGGER.error("Error updating assigned ride status", e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/rides/{id}/location")
    public ResponseEntity<?> updateAssignedRideLocation(
            @PathVariable("id") Long rideId,
            @RequestBody Map<String, Object> request) {
        try {
            Long driverId = currentUserId();
            Ride ride = rideRepository.findById(rideId).orElse(null);
            if (ride == null || !driverId.equals(ride.getDriverId())) {
                return ResponseEntity.status(404).body(Map.of("error", "Assigned ride not found"));
            }
            Double latitude = coordinateValue(request.get("latitude"));
            Double longitude = coordinateValue(request.get("longitude"));
            if (latitude == null || longitude == null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
                return ResponseEntity.badRequest().body(Map.of("error", "Valid latitude and longitude are required"));
            }
            ride.setCurrentLat(latitude);
            ride.setCurrentLng(longitude);
            Ride saved = rideRepository.save(ride);
            return ResponseEntity.ok(Map.of("rideId", saved.getId(), "currentLat", latitude, "currentLng", longitude));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    private Double coordinateValue(Object value) {
        try { return value == null ? null : Double.valueOf(value.toString()); }
        catch (NumberFormatException ignored) { return null; }
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

            Optional<Driver> driverOpt = findOrCreateDriverProfile(userId);
            if (driverOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "Driver profile not found"));
            }
            Driver driver = driverOpt.get();
            driver.setOnline(online);
            driverRepository.save(driver);

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

    private Optional<Driver> findOrCreateDriverProfile(Long userId) {
        Optional<Driver> existing = driverRepository.findByUserId(userId);
        if (existing.isPresent()) {
            return existing;
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty() || userOpt.get().getRole() != User.Role.DRIVER) {
            return Optional.empty();
        }

        User user = userOpt.get();
        Driver driver = new Driver();
        driver.setUserId(userId);
        driver.setLicencePlate(user.getLicencePlate());
        driver.setVehicleMake(user.getVehicleMake());
        driver.setVehicleYear(user.getVehicleYear());
        driver.setOnline(false);
        driver.setTotalTrips(0);
        driver.setApprovalStatus(user.getStatus() == User.UserStatus.ACTIVE
                ? Driver.ApprovalStatus.APPROVED
                : Driver.ApprovalStatus.PENDING);
        LOGGER.warn("Repaired missing driver profile for user {}", userId);
        return Optional.of(driverRepository.save(driver));
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
