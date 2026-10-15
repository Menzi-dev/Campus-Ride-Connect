// Payment record API: save a pending payment record for a ride. This code does not call a real card
// payment provider.
// Where: PaymentController handles /api/rides/{rideId}/payment;
// @GetMapping/@PostMapping/@PutMapping identify the actions below.
// How: Spring reads request fields/path IDs, invokes these controller methods and returns their
// ResponseEntity. Service/repository/JDBC calls inside the methods perform the actual work.
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

/** Creates and reads payment records; stored status changes do not represent payment-gateway settlement. */
@RestController
@RequestMapping("/api/rides/{rideId}/payment")
@CrossOrigin(origins = "*")
public class PaymentController {

    @Autowired
    private RideRepository rideRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    // Feature: Validate the ride/payment request and insert a pending record without charging a
    // real bank card.
    // Where: PaymentController.createPayment() below.
    // How: createPayment() uses rideRepository.findById() and jdbcTemplate.update() to read,
    // validate or save the data for this operation. The return/exception handling below supplies
    // its result to the caller.
    @PostMapping
    public ResponseEntity<?> createPayment(@PathVariable Long rideId, @RequestBody Map<String, String> request) {
        try {
            Long userId = currentUserId();
            Ride ride = rideRepository.findById(rideId)
                    .orElseThrow(() -> new IllegalArgumentException("Ride not found"));
            if (!userId.equals(ride.getRiderId())) {
                return ResponseEntity.status(403).body(Map.of("error", "Only the rider can pay for this ride"));
            }
            if (ride.getFaceMatchedAt() == null)
                return ResponseEntity.badRequest().body(Map.of("error", "A completed face match is required before confirming this ride's payment method."));

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

    // Feature: Read the signed-in account identifier from Spring Security instead of trusting a
    // client-supplied identity.
    // Where: PaymentController.currentUserId() below.
    // How: currentUserId() uses Long.valueOf() and SecurityContextHolder.getContext() to
    // build/check the result returned by the code below.
    private Long currentUserId() {
        return Long.valueOf((String) SecurityContextHolder.getContext().getAuthentication().getPrincipal());
    }
}
