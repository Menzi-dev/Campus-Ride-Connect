package com.campusconnect.controller;

import com.campusconnect.dto.AuthRequest;
import com.campusconnect.dto.AuthResponse;
import com.campusconnect.dto.RegisterRequest;
import com.campusconnect.entity.User;
import com.campusconnect.repository.UserRepository;
import com.campusconnect.service.AuthService;
import com.campusconnect.service.PasswordResetService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private AuthService authService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordResetService passwordResetService;

    @Autowired
    private com.campusconnect.service.EmailVerificationService emailVerificationService;

    @Autowired
    private com.campusconnect.security.JwtTokenProvider jwtTokenProvider;

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
            @RequestParam(value = "vehiclePhoto", required = false) MultipartFile vehiclePhoto,
            @RequestParam(value = "selfie", required = false) MultipartFile selfie,
            @RequestParam(value = "faceScanMetadata", required = false) String faceScanMetadata,
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
        try {
            Map<String, Object> documents = new HashMap<>();
            addApplicationDocument(documents, "proof", proofOfRegistration);
            addApplicationDocument(documents, "licence", driverLicence);
            addApplicationDocument(documents, "vehicle", vehicleRegistration);
            request.setApplicationDocuments(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(documents));
        } catch (Exception error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        }

        if (vehiclePhoto != null && !vehiclePhoto.isEmpty()) {
            String contentType = vehiclePhoto.getContentType();
            if (contentType == null || !Set.of("image/jpeg", "image/png", "image/webp").contains(contentType)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Vehicle photo must be a JPEG, PNG, or WebP image"));
            }
            if (vehiclePhoto.getSize() > 4L * 1024 * 1024) {
                return ResponseEntity.badRequest().body(Map.of("error", "Vehicle photo must be 4 MB or smaller"));
            }
            try {
                request.setVehiclePhoto("data:" + contentType + ";base64," + Base64.getEncoder().encodeToString(vehiclePhoto.getBytes()));
            } catch (IOException e) {
                return ResponseEntity.badRequest().body(Map.of("error", "Could not read vehicle photo"));
            }
        }

        // Process selfie if present
        if (selfie != null && !selfie.isEmpty()) {
            try {
                // Convert to Base64 and store as face embedding
                byte[] selfieBytes = selfie.getBytes();
                String encodedSelfie = Base64.getEncoder().encodeToString(selfieBytes);
                if (selfie.getSize() > 2L * 1024 * 1024 || !"image/jpeg".equals(selfie.getContentType())) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Enrollment photo must be a JPEG smaller than 2 MB"));
                }
                request.setFaceEnrollmentPhoto("data:image/jpeg;base64," + encodedSelfie);
                request.setFaceVerified(false);
                if (faceScanMetadata != null) {
                    if (faceScanMetadata.length() > 2048) return ResponseEntity.badRequest().body(Map.of("error", "Scan details are too large"));
                    request.setFaceScanMetadata(faceScanMetadata);
                }
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

        return ResponseEntity.status(410).body(Map.of("success", false, "message", "Photo uploads do not verify face movements. Use the guided camera scan."));
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

        return ResponseEntity.status(410).body(Map.of("success", false, "message", "Photo uploads cannot verify identity. Use registration guided enrollment."));
    }

    private ResponseEntity<?> registerInternal(RegisterRequest request) {
        try {
            User user = authService.register(request);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            boolean needsEmailVerification = user.requiresEmailVerification();
            response.put("message", needsEmailVerification
                ? "Account created. Check your inbox to verify your email before signing in."
                : "Driver application submitted. Waiting for administrator approval.");
            response.put("emailVerificationRequired", needsEmailVerification);
            if (user.getRole() == User.Role.DRIVER) response.put("token", jwtTokenProvider.generateToken(user));
            response.put("user", user);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    private void addApplicationDocument(Map<String, Object> documents, String kind, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) return;
        if (file.getSize() > 4L * 1024 * 1024) throw new IllegalArgumentException("Documents must be 4 MB or smaller");
        byte[] bytes = file.getBytes();
        String type = file.getContentType();
        boolean valid = "application/pdf".equals(type) && bytes.length > 4 && bytes[0] == '%' && bytes[1] == 'P' && bytes[2] == 'D' && bytes[3] == 'F'
            || "image/jpeg".equals(type) && bytes.length > 2 && (bytes[0] & 255) == 255 && (bytes[1] & 255) == 216
            || "image/png".equals(type) && bytes.length > 8 && (bytes[0] & 255) == 137 && bytes[1] == 'P' && bytes[2] == 'N' && bytes[3] == 'G';
        if (!valid) throw new IllegalArgumentException("Documents must be valid PDF, JPEG or PNG files");
        documents.put(kind, Map.of("contentType", type, "data", Base64.getEncoder().encodeToString(bytes)));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthRequest request) {
        try {
            AuthResponse response = authService.login(request);
            return ResponseEntity.ok(response);
        } catch (AuthService.EmailNotVerifiedException e) {
            return ResponseEntity.status(403).body(Map.of("code", "EMAIL_NOT_VERIFIED", "error", e.getMessage()));
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(401).body(error);
        }
    }

    @PostMapping("/email-verification/confirm")
    public ResponseEntity<?> confirmEmail(@RequestBody Map<String, String> request) {
        try {
            emailVerificationService.verify(request.get("token"));
            return ResponseEntity.ok(Map.of("message", "Email verified successfully. You can now log in."));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        }
    }

    @PostMapping("/email-verification/resend")
    public ResponseEntity<?> resendVerification(@RequestBody Map<String, String> request) {
        String address = request.get("email");
        if (address == null || address.length() > 255 || !address.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"))
            return ResponseEntity.badRequest().body(Map.of("error", "Enter a valid email address"));
        emailVerificationService.resend(address);
        return ResponseEntity.ok(Map.of("message", "If this account needs verification, a verification email will be sent. Please wait at least 60 seconds before requesting another."));
    }

    @PostMapping("/email-verification/confirm-code")
    public ResponseEntity<?> confirmEmailCode(@RequestBody Map<String, String> request) {
        String address = request.get("email");
        if (address == null || address.length() > 255 || !address.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"))
            return ResponseEntity.badRequest().body(Map.of("error", "Enter your registration email and a six-digit verification code"));
        try {
            emailVerificationService.verifyCode(address, request.get("code"));
            return ResponseEntity.ok(Map.of("message", "Email verified successfully. You can now log in."));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        }
    }

    @PostMapping("/password-reset/request")
    public ResponseEntity<?> requestPasswordReset(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email is required"));
        }

        passwordResetService.requestCode(email);
        return ResponseEntity.ok(Map.of(
                "message", "If an account exists for that email, a reset code has been sent"));
    }

    @PostMapping("/password-reset/verify")
    public ResponseEntity<?> verifyPasswordResetCode(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String code = request.get("code");
        if (email == null || email.isBlank() || code == null || !code.matches("\\d{6}")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email and a 6-digit code are required"));
        }

        try {
            passwordResetService.verifyCode(email, code);
            return ResponseEntity.ok(Map.of("message", "Reset code verified"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/password-reset/confirm")
    public ResponseEntity<?> confirmPasswordReset(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String code = request.get("code");
        String newPassword = request.get("newPassword");
        String confirmPassword = request.get("confirmPassword");
        if (email == null || email.isBlank() || code == null || newPassword == null || newPassword.length() < 8) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Email, reset code, and a password of at least 8 characters are required"));
        }
        if (confirmPassword == null || !newPassword.equals(confirmPassword)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Passwords do not match"));
        }

        try {
            passwordResetService.resetPassword(email, code, newPassword);
            return ResponseEntity.ok(Map.of("message", "Password updated successfully"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
