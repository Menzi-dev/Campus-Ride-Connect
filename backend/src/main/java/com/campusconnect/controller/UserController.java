// Account profile API: retrieve and update user details, profile photos and saved payment
// preferences.
// Where: UserController handles /api/users; @GetMapping/@PostMapping/@PutMapping identify the
// actions below.
// How: Spring reads request fields/path IDs, invokes these controller methods and returns their
// ResponseEntity. Service/repository/JDBC calls inside the methods perform the actual work.
package com.campusconnect.controller;

import com.campusconnect.entity.Driver;
import com.campusconnect.entity.User;
import com.campusconnect.repository.DriverRepository;
import com.campusconnect.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/** Provides the signed-in account profile, photos, face enrollment and saved payment preferences. */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private final JdbcTemplate jdbcTemplate;
    private final UserRepository userRepository;
    private final DriverRepository driverRepository;

    public UserController(JdbcTemplate jdbcTemplate, UserRepository userRepository, DriverRepository driverRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.userRepository = userRepository;
        this.driverRepository = driverRepository;
    }

    // Feature: Build the account list returned by this endpoint.
    // Where: UserController.getAllUsers() below.
    // How: getAllUsers() uses jdbcTemplate.queryForList() and users.add() to read, validate or save
    // the data for this operation. The return/exception handling below supplies its result to the
    // caller.
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

    // Feature: Return profile information for the signed-in account.
    // Where: UserController.getCurrentUser() below.
    // How: getCurrentUser() uses userRepository.findById() and jdbcTemplate.queryForObject() to
    // read, validate or save the data for this operation. The return/exception handling below
    // supplies its result to the caller.
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getCurrentUser() {
        Long userId = Long.valueOf((String) SecurityContextHolder.getContext().getAuthentication().getPrincipal());
        return userRepository.findById(userId).map(user -> {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("id", user.getId());
            response.put("fullName", user.getFullName());
            response.put("email", user.getEmail());
            response.put("phone", user.getPhone());
            response.put("yearOfStudy", user.getYearOfStudy());
            response.put("faceVerified", Boolean.TRUE.equals(user.getFaceVerified()));
            response.put("profilePhoto", user.getProfilePhoto());
                response.put("defaultPaymentMethod", jdbcTemplate.queryForObject(
                    "SELECT default_payment_method FROM users WHERE user_id = ?", String.class, userId));
                Double riderRating = jdbcTemplate.queryForObject(
                    "SELECT AVG(driver_rating) FROM rides WHERE rider_id = ? AND status = 'COMPLETED'",
                    Double.class, userId);
                Long ratingCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM rides WHERE rider_id = ? AND status = 'COMPLETED' AND driver_rating IS NOT NULL",
                    Long.class, userId);
                response.put("riderRating", riderRating);
                response.put("riderRatingCount", ratingCount == null ? 0 : ratingCount);
            return ResponseEntity.ok(response);
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    // Feature: Validate and save the editable signed-in profile details.
    // Where: UserController.updateCurrentUser() below.
    // How: updateCurrentUser() uses userRepository.findById(), email.length() and email.trim() to
    // read, validate or save the data for this operation. The return/exception handling below
    // supplies its result to the caller.
    @PutMapping("/me")
    public ResponseEntity<Map<String, Object>> updateCurrentUser(@RequestBody Map<String, Object> request) {
        Long userId = currentUserId();
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return ResponseEntity.notFound().build();

        String fullName = stringValue(request.get("fullName"));
        String email = stringValue(request.get("email"));
        if (fullName == null || fullName.isBlank() || fullName.length() > 255) {
            return ResponseEntity.badRequest().body(Map.of("error", "Enter a valid name"));
        }
        if (email == null || !EMAIL_PATTERN.matcher(email).matches() || email.length() > 255) {
            return ResponseEntity.badRequest().body(Map.of("error", "Enter a valid email address"));
        }

        Integer yearOfStudy = null;
        Object rawYear = request.get("yearOfStudy");
        if (rawYear != null && !String.valueOf(rawYear).isBlank()) {
            try {
                yearOfStudy = Integer.valueOf(String.valueOf(rawYear));
            } catch (NumberFormatException e) {
                return ResponseEntity.badRequest().body(Map.of("error", "Enter a valid year of study"));
            }
            if (yearOfStudy < 1 || yearOfStudy > 8) {
                return ResponseEntity.badRequest().body(Map.of("error", "Year of study must be between 1 and 8"));
            }
        }

        user.setFullName(fullName.trim());
        user.setEmail(email.trim());
        user.setPhone(stringValue(request.get("phone")));
        user.setYearOfStudy(yearOfStudy);
        try {
            User saved = userRepository.save(user);
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("id", saved.getId());
            response.put("fullName", saved.getFullName());
            response.put("email", saved.getEmail());
            response.put("phone", saved.getPhone());
            response.put("yearOfStudy", saved.getYearOfStudy());
            response.put("faceVerified", Boolean.TRUE.equals(saved.getFaceVerified()));
            response.put("profilePhoto", saved.getProfilePhoto());
            return ResponseEntity.ok(response);
        } catch (DataIntegrityViolationException e) {
            return ResponseEntity.status(409).body(Map.of("error", "That email address is already in use"));
        }
    }

    // Feature: Validate the supplied photo and save it for the signed-in account.
    // Where: UserController.updateProfilePhoto() below.
    // How: updateProfilePhoto() uses userRepository.findById() and userRepository.save() to read,
    // validate or save the data for this operation. The return/exception handling below supplies
    // its result to the caller.
    @PutMapping("/me/profile-photo")
    public ResponseEntity<Map<String, Object>> updateProfilePhoto(@RequestBody Map<String, String> request) {
        String profilePhoto = request.get("profilePhoto");
        if (profilePhoto != null && (!profilePhoto.matches("(?i)^data:image/(png|jpeg|jpg);base64,[A-Za-z0-9+/]+={0,2}$")
                || profilePhoto.length() > 5_600_000)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Choose a PNG or JPEG image up to 4 MB"));
        }

        Long userId = Long.valueOf((String) SecurityContextHolder.getContext().getAuthentication().getPrincipal());
        return userRepository.findById(userId).map(user -> {
            user.setProfilePhoto(profilePhoto);
            userRepository.save(user);
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("profilePhoto", user.getProfilePhoto());
            return ResponseEntity.ok(response);
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    // Feature: Retrieve saved card display information for the signed-in user.
    // Where: UserController.getPaymentMethods() below.
    // How: getPaymentMethods() calls paymentMethodsFor() and currentUserId() in this class to carry
    // out the operation. Any failed checks stop the operation with the exception shown below.
    @GetMapping("/me/payment-methods")
    public ResponseEntity<?> getPaymentMethods() {
        return ResponseEntity.ok(paymentMethodsFor(currentUserId()));
    }

    // Feature: Save card display metadata and default preference without accepting a full card
    // number or charging it.
    // Where: UserController.addPaymentMethod() below.
    // How: addPaymentMethod() validates the display fields and uses jdbcTemplate to insert
    // user_payment_methods for currentUserId(). It rejects full-card secret fields and does not
    // contact a payment gateway.
    @PostMapping("/me/payment-methods")
    public ResponseEntity<?> addPaymentMethod(@RequestBody Map<String, Object> request) {
        Long userId = currentUserId();
        String label = stringValue(request.get("label"));
        String lastFour = stringValue(request.get("lastFour"));
        String brand = stringValue(request.get("brand"));
        String expiry = stringValue(request.get("expiry"));
        String cardholder = stringValue(request.get("cardholder"));
        if (label == null || label.length() > 80 || lastFour == null || !lastFour.matches("\\d{4}")
                || brand == null || brand.length() > 32 || expiry == null || !expiry.matches("(0[1-9]|1[0-2])/\\d{2}")
                || cardholder == null || cardholder.isBlank() || cardholder.length() > 120) {
            return ResponseEntity.badRequest().body(Map.of("error", "Valid cardholder, brand, expiry, and last four digits are required"));
        }

        Long cardCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_payment_methods WHERE user_id = ?", Long.class, userId);
        if (cardCount != null && cardCount >= 3) {
            return ResponseEntity.badRequest().body(Map.of("error", "You can save up to 3 cards"));
        }

        boolean makeDefault = Boolean.TRUE.equals(request.get("isDefault")) || cardCount == null || cardCount == 0;
        if (makeDefault) {
            jdbcTemplate.update("UPDATE user_payment_methods SET is_default = FALSE WHERE user_id = ?", userId);
        }
        jdbcTemplate.update(
                "INSERT INTO user_payment_methods (user_id, label, last_four, brand, expiry, cardholder, is_default) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?)",
                userId, label.trim(), lastFour, brand.trim(), expiry, cardholder.trim(), makeDefault);
        if (makeDefault) setDefaultPaymentMethod(userId, "CARD");
        return ResponseEntity.ok(paymentMethodsFor(userId));
    }

    // Feature: Choose an owned saved card as the default card.
    // Where: UserController.setDefaultCard() below.
    // How: setDefaultCard() uses jdbcTemplate.queryForObject() and jdbcTemplate.update() to read,
    // validate or save the data for this operation. The return/exception handling below supplies
    // its result to the caller.
    @PutMapping("/me/payment-methods/{cardId}/default")
    public ResponseEntity<?> setDefaultCard(@PathVariable Long cardId) {
        Long userId = currentUserId();
        Integer cardExists = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_payment_methods WHERE id = ? AND user_id = ?", Integer.class, cardId, userId);
        if (cardExists == null || cardExists == 0) return ResponseEntity.notFound().build();
        jdbcTemplate.update("UPDATE user_payment_methods SET is_default = (id = ?) WHERE user_id = ?", cardId, userId);
        setDefaultPaymentMethod(userId, "CARD");
        return ResponseEntity.ok(paymentMethodsFor(userId));
    }

    // Feature: Remove the selected owned card and update the remaining default choice if needed.
    // Where: UserController.deletePaymentMethod() below.
    // How: deletePaymentMethod() uses jdbcTemplate.update() and jdbcTemplate.queryForObject() to
    // read, validate or save the data for this operation. The return/exception handling below
    // supplies its result to the caller.
    @DeleteMapping("/me/payment-methods/{cardId}")
    public ResponseEntity<?> deletePaymentMethod(@PathVariable Long cardId) {
        Long userId = currentUserId();
        jdbcTemplate.update("DELETE FROM user_payment_methods WHERE id = ? AND user_id = ?", cardId, userId);
        List<Map<String, Object>> cards = paymentMethodsFor(userId);
        if (cards.isEmpty()) {
            setDefaultPaymentMethod(userId, "CASH");
        } else {
            Long defaults = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM user_payment_methods WHERE user_id = ? AND is_default = TRUE", Long.class, userId);
            if (defaults == null || defaults == 0) {
                jdbcTemplate.update("UPDATE user_payment_methods SET is_default = TRUE WHERE user_id = ? ORDER BY id LIMIT 1", userId);
            }
        }
        return ResponseEntity.ok(paymentMethodsFor(userId));
    }

    // Feature: Save the account preferred payment category, such as cash or card.
    // Where: UserController.updateDefaultPaymentMethod() below.
    // How: updateDefaultPaymentMethod() uses jdbcTemplate.queryForObject() to read, validate or
    // save the data for this operation. The return/exception handling below supplies its result to
    // the caller.
    @PutMapping("/me/payment-method")
    public ResponseEntity<?> updateDefaultPaymentMethod(@RequestBody Map<String, String> request) {
        Long userId = currentUserId();
        String method = request.getOrDefault("method", "").trim().toUpperCase();
        if (!method.equals("CASH") && !method.equals("CARD")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Choose CASH or CARD"));
        }
        if (method.equals("CARD")) {
            Long cards = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM user_payment_methods WHERE user_id = ?", Long.class, userId);
            if (cards == null || cards == 0) return ResponseEntity.badRequest().body(Map.of("error", "Add a card first"));
        }
        setDefaultPaymentMethod(userId, method);
        return ResponseEntity.ok(Map.of("defaultPaymentMethod", method));
    }

    // Feature: Retrieve saved payment display records belonging to one account.
    // Where: UserController.paymentMethodsFor() below.
    // How: paymentMethodsFor() uses jdbcTemplate.queryForList() to read, validate or save the data
    // for this operation. The return/exception handling below supplies its result to the caller.
    private List<Map<String, Object>> paymentMethodsFor(Long userId) {
        return jdbcTemplate.queryForList(
                "SELECT CAST(id AS CHAR) AS id, label, last_four AS lastFour, brand, expiry, cardholder, is_default AS isDefault "
                        + "FROM user_payment_methods WHERE user_id = ? ORDER BY id", userId);
    }

    private void setDefaultPaymentMethod(Long userId, String method) {
        jdbcTemplate.update("UPDATE users SET default_payment_method = ? WHERE user_id = ?", method, userId);
    }

    // Feature: Read the signed-in account identifier from Spring Security instead of trusting a
    // client-supplied identity.
    // Where: UserController.currentUserId() below.
    // How: currentUserId() uses Long.valueOf() and SecurityContextHolder.getContext() to
    // build/check the result returned by the code below.
    private Long currentUserId() {
        return Long.valueOf((String) SecurityContextHolder.getContext().getAuthentication().getPrincipal());
    }

    private String stringValue(Object value) {
        return value == null ? null : String.valueOf(value).trim();
    }
}
