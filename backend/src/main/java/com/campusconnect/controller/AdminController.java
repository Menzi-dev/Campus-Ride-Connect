package com.campusconnect.controller;

import com.campusconnect.entity.Driver;
import com.campusconnect.entity.User;
import com.campusconnect.repository.DriverRepository;
import com.campusconnect.repository.RideRepository;
import com.campusconnect.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDateTime;
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
        String sql = "SELECT d.driver_id AS driver_id, u.full_name, u.email, d.licence_plate, u.created_at " +
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
                approval.put("fullName", row.get("full_name"));
                approval.put("email", row.get("email"));
                approval.put("licenceNumber", row.get("licence_plate"));
                approval.put("submittedAt", row.get("created_at") != null ? row.get("created_at").toString() : LocalDateTime.now().toString());
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

        String sql = "SELECT d.driver_id AS driver_id, u.full_name, u.email, d.licence_plate, u.created_at " +
                "FROM drivers d " +
                "LEFT JOIN users u ON u.user_id = d.user_id " +
                "WHERE d.approval_status = ? " +
                "ORDER BY u.created_at DESC";

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, approvalStatus.name());
        List<Map<String, Object>> approvals = new ArrayList<>();

        for (Map<String, Object> row : rows) {
            Map<String, Object> approval = new LinkedHashMap<>();
            approval.put("id", String.valueOf(row.get("driver_id")));
            approval.put("fullName", row.get("full_name"));
            approval.put("email", row.get("email"));
            approval.put("licenceNumber", row.get("licence_plate"));
            approval.put("submittedAt", row.get("created_at") != null ? row.get("created_at").toString() : LocalDateTime.now().toString());
            approvals.add(approval);
        }

        return ResponseEntity.ok(approvals);
    }

    @PostMapping("/driver-approvals/{id}/approve")
    public ResponseEntity<?> approveDriver(@PathVariable("id") Long id) {
        return updateDriverApproval(id, Driver.ApprovalStatus.APPROVED);
    }

    @PostMapping("/driver-approvals/{id}/reject")
    public ResponseEntity<?> rejectDriver(@PathVariable("id") Long id) {
        return updateDriverApproval(id, Driver.ApprovalStatus.REJECTED);
    }

    private ResponseEntity<?> updateDriverApproval(Long id, Driver.ApprovalStatus status) {
        return driverRepository.findById(id)
                .map(driver -> {
                    driver.setApprovalStatus(status);
                    driverRepository.save(driver);
                    Map<String, String> response = Map.of("status", status.name());
                    return ResponseEntity.ok(response);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
