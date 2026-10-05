package com.campusconnect.controller;

import com.campusconnect.entity.Driver;
import com.campusconnect.entity.User;
import com.campusconnect.repository.DriverRepository;
import com.campusconnect.repository.RideRepository;
import com.campusconnect.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDateTime;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "*")
public class AdminController {

    private static final Logger LOGGER = LoggerFactory.getLogger(AdminController.class);

    private final UserRepository userRepository;
    private final RideRepository rideRepository;
    private final DriverRepository driverRepository;
    private final JdbcTemplate jdbcTemplate;

    public AdminController(
            UserRepository userRepository,
            RideRepository rideRepository,
            DriverRepository driverRepository,
            JdbcTemplate jdbcTemplate) {
        this.userRepository = userRepository;
        this.rideRepository = rideRepository;
        this.driverRepository = driverRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        try {
            return ResponseEntity.ok(buildStats());
        } catch (Exception e) {
            LOGGER.error("Error building stats", e);
            Map<String, Object> fallback = new LinkedHashMap<>();
            fallback.put("totalUsers", 0);
            fallback.put("totalDrivers", 0);
            fallback.put("ridesToday", 0);
            fallback.put("pendingApprovals", 0);
            fallback.put("activeSOS", 0);
            fallback.put("safetyScorePercent", 0);
            fallback.put("universityName", "SPU Campus Connect");
            return ResponseEntity.ok(fallback);
        }
    }

    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> getDashboard() {
        Map<String, Object> body = new LinkedHashMap<>();
        try {
            body.put("stats", buildStats());
        } catch (Exception e) {
            LOGGER.warn("Failed to build stats for dashboard, returning safe defaults", e);
            Map<String, Object> fallback = new LinkedHashMap<>();
            fallback.put("totalUsers", 0);
            fallback.put("totalDrivers", 0);
            fallback.put("ridesToday", 0);
            fallback.put("pendingApprovals", 0);
            fallback.put("activeSOS", 0);
            fallback.put("safetyScorePercent", 0);
            fallback.put("universityName", "SPU Campus Connect");
            body.put("stats", fallback);
        }

        try {
            body.put("approvals", buildPendingApprovals(Driver.ApprovalStatus.PENDING));
        } catch (Exception e) {
            LOGGER.warn("Failed to load pending approvals, returning empty list", e);
            body.put("approvals", new ArrayList<>());
        }

        return ResponseEntity.ok(body);
    }

    @GetMapping("/dashboard/stats")
    public ResponseEntity<Map<String, Object>> getDashboardStatsLegacy() {
        return getStats();
    }

    @GetMapping("/users")
    public ResponseEntity<List<Map<String, Object>>> getUsers() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT user_id AS id, full_name, email, role, status FROM users ORDER BY created_at DESC");
        List<Map<String, Object>> users = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> user = new LinkedHashMap<>();
            user.put("id", row.get("id"));
            user.put("fullName", row.get("full_name"));
            user.put("email", row.get("email"));
            user.put("role", row.get("role"));
            user.put("status", row.get("status"));
            users.add(user);
        }
        return ResponseEntity.ok(users);
    }

    @PutMapping("/users/{id}/status")
    public ResponseEntity<Map<String, Object>> updateUserStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> request) {
        User.UserStatus status;
        try {
            status = User.UserStatus.valueOf(request.getOrDefault("status", "").toUpperCase());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }

        return userRepository.findById(id)
                .map(user -> {
                    user.setStatus(status);
                    userRepository.save(user);
                    Map<String, Object> response = new LinkedHashMap<>();
                    response.put("id", user.getId());
                    response.put("status", user.getStatus().name());
                    return ResponseEntity.ok(response);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/rides/monitoring")
    public ResponseEntity<List<Map<String, Object>>> getRideMonitoring() {
        String sql = "SELECT r.ride_id, r.status, r.pickup_location, r.destination, "
                + "r.pickup_lat, r.pickup_lng, r.dest_lat, r.dest_lng, r.created_at, "
                + "r.rider_id, rider.full_name AS rider_name, r.driver_id, driver.full_name AS driver_name, "
                + "s.alert_id, s.status AS sos_status, s.gps_lat AS sos_lat, s.gps_lng AS sos_lng "
                + "FROM rides r "
                + "LEFT JOIN users rider ON rider.user_id = r.rider_id "
                + "LEFT JOIN users driver ON driver.user_id = r.driver_id "
                + "LEFT JOIN sos_alerts s ON s.alert_id = (SELECT MAX(s2.alert_id) FROM sos_alerts s2 WHERE s2.ride_id = r.ride_id AND s2.status = 'DISPATCHED') "
                + "WHERE r.status IN ('PENDING', 'ACCEPTED', 'ENROUTE', 'ARRIVED', 'STARTED') "
                + "AND r.updated_at >= DATE_SUB(NOW(), INTERVAL 2 HOUR) "
                + "ORDER BY CASE WHEN s.alert_id IS NULL THEN 1 ELSE 0 END, r.created_at DESC";

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);
        List<Map<String, Object>> rides = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> ride = new LinkedHashMap<>();
            ride.put("id", row.get("ride_id"));
            ride.put("status", row.get("status"));
            ride.put("pickupLocation", row.get("pickup_location"));
            ride.put("destination", row.get("destination"));
            ride.put("pickupLat", row.get("pickup_lat"));
            ride.put("pickupLng", row.get("pickup_lng"));
            ride.put("destLat", row.get("dest_lat"));
            ride.put("destLng", row.get("dest_lng"));
            ride.put("createdAt", row.get("created_at"));
            ride.put("riderName", row.get("rider_name"));
            ride.put("driverName", row.get("driver_name"));
            if (row.get("alert_id") == null) {
                ride.put("sos", null);
            } else {
                Map<String, Object> sos = new LinkedHashMap<>();
                sos.put("id", row.get("alert_id"));
                sos.put("status", row.get("sos_status"));
                sos.put("gpsLat", row.get("sos_lat"));
                sos.put("gpsLng", row.get("sos_lng"));
                ride.put("sos", sos);
            }
            rides.add(ride);
        }
        return ResponseEntity.ok(rides);
    }

    @GetMapping("/incidents")
    public ResponseEntity<List<Map<String, Object>>> getIncidents() {
        String sql = "SELECT s.alert_id, s.status AS incident_status, s.audio_file_path, "
                + "s.recording_duration, s.created_at, r.ride_id, r.pickup_location, r.destination, "
                + "rider.full_name AS rider_name, driver.full_name AS driver_name "
                + "FROM sos_alerts s "
                + "JOIN rides r ON r.ride_id = s.ride_id "
                + "LEFT JOIN users rider ON rider.user_id = r.rider_id "
                + "LEFT JOIN users driver ON driver.user_id = r.driver_id "
                + "ORDER BY s.created_at DESC";

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);
        List<Map<String, Object>> incidents = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> incident = new LinkedHashMap<>();
            Long alertId = ((Number) row.get("alert_id")).longValue();
            incident.put("id", alertId);
            incident.put("referenceNumber", String.format("INC-%04d", alertId));
            incident.put("type", "SOS_ALERT");
            incident.put("typeLabel", "SOS Alert");
            incident.put("status", incidentStatus(row.get("incident_status")));
            incident.put("rideId", row.get("ride_id"));
            incident.put("rideReference", String.format("R-%d", ((Number) row.get("ride_id")).longValue()));
            incident.put("riderName", row.get("rider_name"));
            incident.put("driverName", row.get("driver_name"));
            incident.put("pickupLocation", row.get("pickup_location"));
            incident.put("destination", row.get("destination"));
            incident.put("createdAt", row.get("created_at"));
            incident.put("hasAudio", row.get("audio_file_path") != null);
            incident.put("recordingDuration", row.get("recording_duration"));
            incidents.add(incident);
        }
        return ResponseEntity.ok(incidents);
    }

    @GetMapping("/settings")
    public ResponseEntity<Map<String, Object>> getSettings() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "SELECT university_name, email_domain, campus_security_phone, "
                + "sos_response_time_seconds, first_year_priority_matching, updated_at "
                + "FROM admin_platform_settings LIMIT 1");
        if (rows.isEmpty()) {
            Map<String, Object> defaults = defaultSettings();
            jdbcTemplate.update("INSERT INTO admin_platform_settings "
                    + "(university_name, email_domain, campus_security_phone, sos_response_time_seconds, "
                    + "first_year_priority_matching, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                    defaults.get("universityName"), defaults.get("emailDomain"), defaults.get("campusSecurityPhone"),
                    defaults.get("sosResponseTimeSeconds"), defaults.get("firstYearPriorityMatching"), defaults.get("updatedAt"));
            rows = jdbcTemplate.queryForList(
                    "SELECT university_name, email_domain, campus_security_phone, "
                    + "sos_response_time_seconds, first_year_priority_matching, updated_at "
                        + "FROM admin_platform_settings LIMIT 1");
        }
        return ResponseEntity.ok(settingsResponse(rows.get(0)));
    }

    @PutMapping("/settings")
    public ResponseEntity<?> updateSettings(@RequestBody Map<String, Object> request) {
        String universityName = textValue(request.get("universityName"));
        String emailDomain = textValue(request.get("emailDomain"));
        String campusSecurityPhone = textValue(request.get("campusSecurityPhone"));
        Integer responseTime = integerValue(request.get("sosResponseTimeSeconds"));

        if (universityName.isBlank() || universityName.length() > 160) {
            return ResponseEntity.badRequest().body(Map.of("error", "University name is required and must be 160 characters or fewer"));
        }
        if (!emailDomain.matches("^@?[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Enter a valid email domain, such as @spu.ac.za"));
        }
        if (campusSecurityPhone.isBlank() || campusSecurityPhone.length() > 40) {
            return ResponseEntity.badRequest().body(Map.of("error", "Campus Security phone number is required"));
        }
        if (responseTime == null || responseTime < 1 || responseTime > 3600) {
            return ResponseEntity.badRequest().body(Map.of("error", "SOS response time must be between 1 and 3600 seconds"));
        }

        String normalizedDomain = emailDomain.startsWith("@") ? emailDomain : "@" + emailDomain;
        boolean priorityMatching = Boolean.TRUE.equals(request.get("firstYearPriorityMatching"));
        LocalDateTime updatedAt = LocalDateTime.now();
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT id, university_name FROM admin_platform_settings LIMIT 1");
        if (rows.isEmpty()) {
            jdbcTemplate.update("INSERT INTO admin_platform_settings "
                    + "(university_name, email_domain, campus_security_phone, sos_response_time_seconds, "
                    + "first_year_priority_matching, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                universityName, normalizedDomain, campusSecurityPhone, responseTime, priorityMatching, updatedAt);
        } else {
            Long id = ((Number) rows.get(0).get("id")).longValue();
            jdbcTemplate.update("UPDATE admin_platform_settings SET university_name = ?, email_domain = ?, "
                    + "campus_security_phone = ?, sos_response_time_seconds = ?, "
                    + "first_year_priority_matching = ?, updated_at = ? WHERE id = ?",
                    universityName, normalizedDomain, campusSecurityPhone, responseTime, priorityMatching, updatedAt, id);
        }
        return getSettings();
    }

    private Map<String, Object> defaultSettings() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("universityName", "Sol Plaatje University");
        response.put("emailDomain", "@spu.ac.za");
        response.put("campusSecurityPhone", "+27 11 559 4555");
        response.put("sosResponseTimeSeconds", 60);
        response.put("firstYearPriorityMatching", true);
        response.put("updatedAt", LocalDateTime.now());
        return response;
    }

    private Map<String, Object> settingsResponse(Map<String, Object> row) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("universityName", row.get("university_name"));
        response.put("emailDomain", row.get("email_domain"));
        response.put("campusSecurityPhone", row.get("campus_security_phone"));
        response.put("sosResponseTimeSeconds", row.get("sos_response_time_seconds"));
        response.put("firstYearPriorityMatching", Boolean.TRUE.equals(row.get("first_year_priority_matching")) || "1".equals(String.valueOf(row.get("first_year_priority_matching"))));
        response.put("updatedAt", row.get("updated_at"));
        return response;
    }

    private String textValue(Object value) {
        return value == null ? "" : value.toString().trim();
    }

    private Integer integerValue(Object value) {
        try {
            return value == null ? null : Integer.valueOf(value.toString());
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    @GetMapping("/incidents/{id}")
    public ResponseEntity<Map<String, Object>> getIncident(@PathVariable Long id) {
        return getIncidents().getBody().stream()
                .filter(incident -> id.equals(incident.get("id")))
                .findFirst()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/incidents/{id}/audio")
    public ResponseEntity<Resource> getIncidentAudio(@PathVariable Long id) {
        List<Map<String, Object>> incidents = jdbcTemplate.queryForList(
                "SELECT audio_file_path FROM sos_alerts WHERE alert_id = ?", id);
        if (incidents.isEmpty() || incidents.get(0).get("audio_file_path") == null) {
            return ResponseEntity.notFound().build();
        }

        Path audioPath = Paths.get(incidents.get(0).get("audio_file_path").toString());
        if (!Files.isRegularFile(audioPath)) {
            return ResponseEntity.notFound().build();
        }

        String contentType;
        try {
            contentType = Files.probeContentType(audioPath);
        } catch (Exception ignored) {
            contentType = null;
        }
        MediaType mediaType = contentType == null ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(contentType);
        return ResponseEntity.ok().contentType(mediaType).body(new FileSystemResource(audioPath));
    }

    private String incidentStatus(Object status) {
        String value = status == null ? "DISPATCHED" : status.toString().toUpperCase();
        return switch (value) {
            case "RESOLVED" -> "RESOLVED";
            case "CLOSED" -> "CLOSED";
            default -> "INVESTIGATING";
        };
    }

    private Map<String, Object> buildStats() {
        try {
            long totalUsers = userRepository.count();
            long totalDrivers = userRepository.countByRole(User.Role.DRIVER);
                // Use a plain SQL count to avoid JPA-generated queries that assume a specific
                // primary-key column name (some deployments have schema drift where `id` is
                // missing). This is resilient and efficient for the admin stats query.
                Object ridesCountObj = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM rides WHERE created_at > ?",
                    new Object[]{java.sql.Timestamp.valueOf(LocalDateTime.now().minusDays(1))},
                    Integer.class
                );
                int ridesToday = ridesCountObj != null ? (Integer) ridesCountObj : 0;
            long pendingApprovals = driverRepository.countByApprovalStatus(Driver.ApprovalStatus.PENDING);

            Map<String, Object> stats = new LinkedHashMap<>();
            stats.put("totalUsers", totalUsers);
            stats.put("totalDrivers", totalDrivers);
            stats.put("ridesToday", ridesToday);
            stats.put("pendingApprovals", pendingApprovals);
            stats.put("activeSOS", 0);
            stats.put("safetyScorePercent", 100);
            stats.put("universityName", "SPU Campus Connect");
            return stats;
        } catch (Exception e) {
            LOGGER.error("Exception while building stats", e);
            Map<String, Object> stats = new LinkedHashMap<>();
            stats.put("totalUsers", 0);
            stats.put("totalDrivers", 0);
            stats.put("ridesToday", 0);
            stats.put("pendingApprovals", 0);
            stats.put("activeSOS", 0);
            stats.put("safetyScorePercent", 0);
            stats.put("universityName", "SPU Campus Connect");
            return stats;
        }
    }

    private List<Map<String, Object>> buildPendingApprovals(Driver.ApprovalStatus approvalStatus) {
        String sql = "SELECT d.driver_id AS driver_id, d.user_id AS user_id, u.full_name, u.email, u.student_number, u.phone, u.year_of_study, " +
                "d.licence_plate, d.vehicle_make, d.vehicle_year, u.created_at " +
                "FROM drivers d " +
                "LEFT JOIN users u ON u.user_id = d.user_id " +
                "WHERE d.approval_status = ? " +
                "ORDER BY u.created_at DESC";

        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, approvalStatus.name());
            List<Map<String, Object>> approvals = new ArrayList<>();

            for (Map<String, Object> row : rows) {
                Map<String, Object> approval = new LinkedHashMap<>();
                approval.put("id", String.valueOf(row.get("driver_id")));
                approval.put("userId", row.get("user_id") != null ? String.valueOf(row.get("user_id")) : "");
                approval.put("fullName", row.get("full_name"));
                approval.put("email", row.get("email"));
                approval.put("studentNumber", row.get("student_number"));
                approval.put("phone", row.get("phone"));
                approval.put("yearOfStudy", row.get("year_of_study"));
                approval.put("licencePlate", row.get("licence_plate"));
                approval.put("vehicleMake", row.get("vehicle_make"));
                approval.put("vehicleYear", row.get("vehicle_year"));
                approval.put("selfieUrl", null);
                approval.put("licenceDocUrl", null);
                approval.put("proofDocUrl", null);
                approval.put("vehicleDocUrl", null);
                approval.put("submittedAt", row.get("created_at") != null ? row.get("created_at").toString() : LocalDateTime.now().toString());
                approval.put("status", approvalStatus.name());
                approval.put("role", "DRIVER");
                approvals.add(approval);
            }

            return approvals;
        } catch (Exception e) {
            LOGGER.warn("Failed to query pending approvals", e);
            return new ArrayList<>();
        }
    }

    @GetMapping("/driver-approvals")
    public ResponseEntity<List<Map<String, Object>>> getPendingDriverApprovals(
            @RequestParam(value = "status", required = false, defaultValue = "PENDING") String status
    ) {
        Driver.ApprovalStatus approvalStatus;
        try {
            approvalStatus = Driver.ApprovalStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException e) {
            approvalStatus = Driver.ApprovalStatus.PENDING;
        }

        return ResponseEntity.ok(buildPendingApprovals(approvalStatus));
    }

    @GetMapping("/driver-approvals/pending")
    public ResponseEntity<List<Map<String, Object>>> getPendingDriverApprovalsLegacy() {
        return ResponseEntity.ok(buildPendingApprovals(Driver.ApprovalStatus.PENDING));
    }

    @PostMapping("/driver-approvals/{id}/approve")
    @Transactional
    public ResponseEntity<?> approveDriver(@PathVariable("id") Long id) {
        return updateDriverApproval(id, Driver.ApprovalStatus.APPROVED);
    }

    @PostMapping("/driver-approvals/{id}/reject")
    @Transactional
    public ResponseEntity<?> rejectDriver(@PathVariable("id") Long id) {
        return updateDriverApproval(id, Driver.ApprovalStatus.REJECTED);
    }

    private ResponseEntity<?> updateDriverApproval(Long id, Driver.ApprovalStatus status) {
        return driverRepository.findById(id)
                .map(driver -> {
                    driver.setApprovalStatus(status);
                    driverRepository.save(driver);

                    User user = userRepository.findById(driver.getUserId()).orElse(null);
                    if (user != null) {
                        user.setStatus(status == Driver.ApprovalStatus.APPROVED
                                ? User.UserStatus.ACTIVE
                                : User.UserStatus.SUSPENDED);
                        userRepository.save(user);
                    }

                    Map<String, String> response = Map.of("status", status.name());
                    return ResponseEntity.ok(response);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
