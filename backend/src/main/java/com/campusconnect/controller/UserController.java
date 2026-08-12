package com.campusconnect.controller;

import com.campusconnect.entity.Driver;
import com.campusconnect.entity.User;
import com.campusconnect.repository.DriverRepository;
import com.campusconnect.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final JdbcTemplate jdbcTemplate;
    private final UserRepository userRepository;
    private final DriverRepository driverRepository;

    public UserController(JdbcTemplate jdbcTemplate, UserRepository userRepository, DriverRepository driverRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.userRepository = userRepository;
        this.driverRepository = driverRepository;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllUsers() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "SELECT user_id AS id, full_name, email, role, status FROM users"
        );

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

    @GetMapping("/{id}/status")
    public ResponseEntity<Map<String, Object>> getUserStatus(@PathVariable Long id) {
        return userRepository.findById(id)
            .map(user -> {
                Map<String, Object> response = new LinkedHashMap<>();
                response.put("userId", user.getId());
                response.put("role", user.getRole().name());
                response.put("status", user.getStatus() != null ? user.getStatus().name() : null);

                boolean approved = user.getStatus() == User.UserStatus.ACTIVE;
                if (user.getRole() == User.Role.DRIVER) {
                    approved = approved || driverRepository.findByUserId(id)
                        .map(driver -> driver.getApprovalStatus() == Driver.ApprovalStatus.APPROVED)
                        .orElse(false);
                }

                response.put("approved", approved);
                return ResponseEntity.ok(response);
            })
            .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
