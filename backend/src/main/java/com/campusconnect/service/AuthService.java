package com.campusconnect.service;

import com.campusconnect.dto.AuthRequest;
import com.campusconnect.dto.AuthResponse;
import com.campusconnect.dto.RegisterRequest;
import com.campusconnect.entity.Driver;
import com.campusconnect.entity.User;
import com.campusconnect.repository.DriverRepository;
import com.campusconnect.repository.UserRepository;
import com.campusconnect.security.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.logging.Logger;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;

@Service
public class AuthService {

    private static final Logger logger = Logger.getLogger(AuthService.class.getName());

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private DriverRepository driverRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private EmailVerificationService emailVerificationService;

    public static class EmailNotVerifiedException extends RuntimeException {
        public EmailNotVerifiedException() { super("Verify your email before signing in. You can request a new verification email."); }
    }

    @Transactional
    public User register(RegisterRequest request) {
        try {
            logger.info("Registration request received for email: " + request.getEmail() + ", role: " + request.getRole());
            
            if (request.getEmail() == null || request.getEmail().isBlank()) {
                throw new RuntimeException("Email is required");
            }
            if (request.getPassword() == null || request.getPassword().isBlank()) {
                throw new RuntimeException("Password is required");
            }
            if (request.getFullName() == null || request.getFullName().isBlank()) {
                throw new RuntimeException("Full name is required");
            }
            
            String normalizedEmail = request.getEmail().trim().toLowerCase(java.util.Locale.ROOT);
            if (!normalizedEmail.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) throw new RuntimeException("A valid email is required");
            if (userRepository.existsByEmail(normalizedEmail)) {
                throw new RuntimeException("Email already registered");
            }

            String normalizedRole = request.getRole() == null ? "" : request.getRole().trim().toUpperCase();
            User.Role role;
            switch (normalizedRole) {
                case "RIDER":
                    role = User.Role.RIDER;
                    break;
                case "STUDENT":
                    role = User.Role.RIDER;
                    break;
                case "DRIVER":
                    role = User.Role.DRIVER;
                    break;
                case "ADMIN":
                    role = User.Role.ADMIN;
                    break;
                case "SECURITY":
                    role = User.Role.SECURITY;
                    break;
                default:
                    throw new RuntimeException("Invalid role: " + request.getRole());
            }

            User user = new User();
            user.setFullName(request.getFullName());
            user.setEmail(normalizedEmail);
            user.setEmailVerified(false);
            user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
            user.setRole(role);
            user.setYearOfStudy(request.getYearOfStudy());
            user.setEmergencyContact(request.getEmergencyContact());
            user.setStudentNumber(request.getStudentNumber());
            user.setPhone(request.getPhone());
            // Client-side movement checks are enrollment, not server-verified identity.
            user.setFaceVerified(false);
            user.setFaceEnrollmentPhoto(request.getFaceEnrollmentPhoto());
            user.setApplicationDocuments(request.getApplicationDocuments());
            if (request.getFaceScanMetadata() != null) {
                JsonNode scan = objectMapper.readTree(request.getFaceScanMetadata());
                if (!"mediapipe-guided-movement-v1".equals(scan.path("method").asText())
                        || !scan.path("challenges").isArray()
                        || scan.path("challenges").size() != 5
                        || request.getFaceEnrollmentPhoto() == null) {
                    throw new RuntimeException("Invalid guided scan details");
                }
                user.setFaceScanMetadata(objectMapper.writeValueAsString(Map.of(
                    "method", "mediapipe-guided-movement-v1",
                    "source", "client-reported",
                    "identityVerified", false,
                    "receivedAt", LocalDateTime.now().toString(),
                    "challenges", scan.path("challenges")
                )));
            }
            if (request.getFaceEmbedding() != null && !request.getFaceEmbedding().isBlank()) {
                logger.info("Face embedding size: " + request.getFaceEmbedding().length());
                user.setFaceEmbedding(request.getFaceEmbedding());
            }
            user.setStatus(role == User.Role.DRIVER ? User.UserStatus.PENDING : User.UserStatus.ACTIVE);
            user.setCreatedAt(LocalDateTime.now());

            User savedUser = userRepository.save(user);
            logger.info("User saved successfully with ID: " + savedUser.getId());

            if (role == User.Role.DRIVER) {
                savedUser.setLicencePlate(request.getLicencePlate());
                savedUser.setVehicleMake(request.getVehicleMake());
                savedUser.setVehicleYear(request.getVehicleYear());
                savedUser = userRepository.save(savedUser);

                Driver driver = new Driver();
                driver.setUserId(savedUser.getId());
                driver.setLicencePlate(request.getLicencePlate());
                driver.setVehicleMake(request.getVehicleMake());
                driver.setVehicleYear(request.getVehicleYear());
                driver.setVehiclePhoto(request.getVehiclePhoto());
                driver.setApprovalStatus(Driver.ApprovalStatus.PENDING);
                driverRepository.save(driver);
                logger.info("Driver approval record created with PENDING status");
            }

            if (savedUser.requiresEmailVerification()) emailVerificationService.issue(savedUser);
            return savedUser;
        } catch (Exception e) {
            logger.severe("Registration failed: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Registration failed: " + e.getMessage());
        }
    }

    public AuthResponse login(AuthRequest request) {
        User user = userRepository.findByEmail(request.getEmail().trim().toLowerCase(java.util.Locale.ROOT))
                .orElseThrow(() -> new RuntimeException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new RuntimeException("Invalid email or password");
        }

        if (user.requiresEmailVerification()) throw new EmailNotVerifiedException();

        String token = jwtTokenProvider.generateToken(user);

        AuthResponse response = new AuthResponse();
        response.setToken(token);
        response.setUser(user);
        return response;
    }
}
