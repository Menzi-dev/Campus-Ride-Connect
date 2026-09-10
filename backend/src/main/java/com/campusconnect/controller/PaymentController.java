package com.campusconnect.controller;

import com.campusconnect.entity.Ride;
import com.campusconnect.repository.RideRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/rides/{rideId}/payment")
@CrossOrigin(origins = "*")
public class PaymentController {

    @Autowired
    private RideRepository rideRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @PostMapping
    public ResponseEntity<?> createPayment(@PathVariable Long rideId, @RequestBody Map<String, String> request) {
        try {
            Long userId = currentUserId();
            Ride ride = rideRepository.findById(rideId)
                    .orElseThrow(() -> new IllegalArgumentException("Ride not found"));
            if (!userId.equals(ride.getRiderId())) {
                return ResponseEntity.status(403).body(Map.of("error", "Only the rider can pay for this ride"));
            }

            String method = request.getOrDefault("method", "").trim().toUpperCase();
            if (!method.equals("CASH") && !method.equals("CARD")) {
                return ResponseEntity.badRequest().body(Map.of("error", "Choose cash or card"));
            }
            String transactionRef = request.get("cardLastFour") == null
                    ? null
                    : "CARD-" + request.get("cardLastFour");

            jdbcTemplate.update(
                    "INSERT INTO payments (ride_id, payer_id, amount, method, status, transaction_ref) "
                            + "VALUES (?, ?, ?, ?, 'PENDING', ?)",
                    rideId, userId, ride.getFare(), method, transactionRef);

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", true);
            response.put("rideId", rideId);
            response.put("method", method);
            response.put("amount", ride.getFare());
            response.put("status", "PENDING");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    private Long currentUserId() {
        return Long.valueOf((String) SecurityContextHolder.getContext().getAuthentication().getPrincipal());
    }
}