package com.campusconnect.controller;

import com.campusconnect.dto.AuthRequest;
import com.campusconnect.dto.AuthResponse;
import com.campusconnect.dto.RegisterRequest;
import com.campusconnect.entity.User;
import com.campusconnect.repository.UserRepository;
import com.campusconnect.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private AuthService authService;

    @Autowired
    private UserRepository userRepository;

    @PostMapping(value = "/register", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        return registerInternal(request);
    }

    @PostMapping(value = "/register", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> registerMultipart(
            @RequestParam("fullName") String fullName,
            @RequestParam("email") String email,
            @RequestParam("password") String password,
            @RequestParam("role") String role,
            @RequestParam(value = "yearOfStudy", required = false) Integer yearOfStudy,
            @RequestParam(value = "emergencyContact", required = false) String emergencyContact,
            @RequestParam(value = "studentNumber", required = false) String studentNumber,
            @RequestParam(value = "phone", required = false) String phone,
            @RequestParam(value = "licencePlate", required = false) String licencePlate,
            @RequestParam(value = "vehicleMake", required = false) String vehicleMake,
            @RequestParam(value = "vehicleYear", required = false) Integer vehicleYear,
            @RequestParam(value = "selfie", required = false) MultipartFile selfie,
            @RequestParam(value = "proofOfRegistration", required = false) MultipartFile proofOfRegistration,
            @RequestParam(value = "driverLicence", required = false) MultipartFile driverLicence,
            @RequestParam(value = "vehicleRegistration", required = false) MultipartFile vehicleRegistration) {

        RegisterRequest request = new RegisterRequest();
        request.setFullName(fullName);
        request.setEmail(email);
        request.setPassword(password);
        request.setRole(role);
        request.setYearOfStudy(yearOfStudy);
        request.setEmergencyContact(emergencyContact);
        request.setStudentNumber(studentNumber);
        request.setPhone(phone);
        request.setLicencePlate(licencePlate);
        request.setVehicleMake(vehicleMake);
        request.setVehicleYear(vehicleYear);

        // Process selfie if present
        if (selfie != null && !selfie.isEmpty()) {
            try {
                // Convert to Base64 and store as face embedding
                byte[] selfieBytes = selfie.getBytes();
                String encodedSelfie = Base64.getEncoder().encodeToString(selfieBytes);
                request.setFaceEmbedding("data:image/jpeg;base64," + encodedSelfie);
                request.setFaceVerified(true);
            } catch (IOException e) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "Could not process selfie upload: " + e.getMessage());
                return ResponseEntity.status(500).body(error);
            }
        }

        return registerInternal(request);
    }

    @PostMapping(value = "/face/verify-direction", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> verifyFaceDirection(
            @RequestParam("direction") String direction,
            @RequestParam("image") MultipartFile image) {
        if (direction == null || direction.isBlank()) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Direction is required");
            return ResponseEntity.badRequest().body(error);
        }
        if (image == null || image.isEmpty()) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Image is required");
            return ResponseEntity.badRequest().body(error);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Face direction verified");
        return ResponseEntity.ok(response);
    }

    @PostMapping(value = "/verification/face", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> verifyFace(
            @RequestParam(value = "email", required = false) String email,
            @RequestParam("selfie") MultipartFile selfie) {
        if (selfie == null || selfie.isEmpty()) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Selfie image is required");
            return ResponseEntity.badRequest().body(error);
        }

        if (email != null && !email.isBlank()) {
            userRepository.findByEmail(email.trim().toLowerCase()).ifPresent(user -> {
                try {
                    String encodedSelfie = Base64.getEncoder().encodeToString(selfie.getBytes());
                    user.setFaceEmbedding("data:image/jpeg;base64," + encodedSelfie);
                    user.setFaceVerified(true);
                    userRepository.save(user);
                } catch (IOException ignored) {
                }
            });
        }

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Face selfie received");
        return ResponseEntity.ok(response);
    }

    private ResponseEntity<?> registerInternal(RegisterRequest request) {
        try {
            User user = authService.register(request);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Registration successful!");
            response.put("user", user);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthRequest request) {
        try {
            AuthResponse response = authService.login(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(401).body(error);
        }
    }
}