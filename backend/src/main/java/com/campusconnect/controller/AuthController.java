// Account API: receive registration, login, enrollment upload, email confirmation and password
// recovery requests. Delegate account rules to services and return a result to the client.
// Where: AuthController handles /api/auth; @GetMapping/@PostMapping/@PutMapping identify the
// actions below.
// How: Spring reads request fields/path IDs, invokes these controller methods and returns their
// ResponseEntity. Service/repository/JDBC calls inside the methods perform the actual work.
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

/** Handles registration, login, email verification and password recovery HTTP requests. */
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

    // Feature: Validate registration details and save the account through the registration service.
    // Where: AuthController.register() below.
    // How: register() passes the JSON request to registerInternal() in this class. That shared
    // handler calls AuthService.register() and returns the account result.
    @PostMapping(value = "/register", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        return registerInternal(request);
    }

    // Feature: Collect form fields, enrollment data and uploaded driver files into one registration
    // request.
    // Where: AuthController.registerMultipart() below.
    // How: registerMultipart() calls addApplicationDocument() and registerInternal() in this class
    // to carry out the operation. Any failed checks stop the operation with the exception shown
    // below.
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

    // Feature: Run the shared registration flow and return the next account verification or
    // approval step.
    // Where: AuthController.registerInternal() below.
    // How: registerInternal() uses authService.register() and jwtTokenProvider.generateToken() to
    // read, validate or save the data for this operation. The return/exception handling below
    // supplies its result to the caller.
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

    // Feature: Read an uploaded application file and add its name, type and content to the stored
    // document details.
    // Where: AuthController.addApplicationDocument() below.
    // How: addApplicationDocument() uses file.isEmpty(), file.getSize() and file.getBytes() to
    // build/check the result returned by the code below.
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

    // Feature: Check the email and password and return the login result, including the session
    // token on success.
    // Where: AuthController.login() below.
    // How: login() calls authService.login(request); it returns the token/account or handles the
    // login exception for the client.
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

    // Feature: Check the emailed link token and mark the account email verified if it is valid.
    // Where: AuthController.confirmEmail() below.
    // How: confirmEmail() uses emailVerificationService.verify() to read, validate or save the data
    // for this operation. The return/exception handling below supplies its result to the caller.
    @PostMapping("/email-verification/confirm")
    public ResponseEntity<?> confirmEmail(@RequestBody Map<String, String> request) {
        try {
            emailVerificationService.verify(request.get("token"));
            return ResponseEntity.ok(Map.of("message", "Email verified successfully. You can now log in."));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        }
    }

    // Feature: Request another verification email while applying the service resend rules.
    // Where: AuthController.resendVerification() below.
    // How: resendVerification() uses emailVerificationService.resend() to read, validate or save
    // the data for this operation. The return/exception handling below supplies its result to the
    // caller.
    @PostMapping("/email-verification/resend")
    public ResponseEntity<?> resendVerification(@RequestBody Map<String, String> request) {
        String address = request.get("email");
        if (address == null || address.length() > 255 || !address.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"))
            return ResponseEntity.badRequest().body(Map.of("error", "Enter a valid email address"));
        emailVerificationService.resend(address);
        return ResponseEntity.ok(Map.of("message", "If this account needs verification, a verification email will be sent. Please wait at least 60 seconds before requesting another."));
    }

    // Feature: Check the submitted email and code through the email verification service.
    // Where: AuthController.confirmEmailCode() below.
    // How: confirmEmailCode() uses emailVerificationService.verifyCode() to read, validate or save
    // the data for this operation. The return/exception handling below supplies its result to the
    // caller.
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

    // Feature: Ask the recovery service to issue an emailed password reset code.
    // Where: AuthController.requestPasswordReset() below.
    // How: requestPasswordReset() uses email.isBlank() and passwordResetService.requestCode() to
    // read, validate or save the data for this operation. The return/exception handling below
    // supplies its result to the caller.
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

    // Feature: Check the submitted recovery code before allowing the next reset step.
    // Where: AuthController.verifyPasswordResetCode() below.
    // How: verifyPasswordResetCode() uses email.isBlank() and passwordResetService.verifyCode() to
    // read, validate or save the data for this operation. The return/exception handling below
    // supplies its result to the caller.
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

    // Feature: Validate the recovery details and ask the service to save the new password.
    // Where: AuthController.confirmPasswordReset() below.
    // How: confirmPasswordReset() uses email.isBlank() and passwordResetService.resetPassword() to
    // read, validate or save the data for this operation. The return/exception handling below
    // supplies its result to the caller.
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
