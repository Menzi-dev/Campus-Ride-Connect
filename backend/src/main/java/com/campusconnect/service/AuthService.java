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
            
            if (userRepository.existsByEmail(request.getEmail())) {
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
            user.setEmail(request.getEmail().toLowerCase());
            user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
            user.setRole(role);
            user.setYearOfStudy(request.getYearOfStudy());
            user.setEmergencyContact(request.getEmergencyContact());
            user.setStudentNumber(request.getStudentNumber());
            user.setPhone(request.getPhone());
            user.setFaceVerified(request.getFaceVerified() != null && request.getFaceVerified());
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
                driver.setApprovalStatus(Driver.ApprovalStatus.PENDING);
                driverRepository.save(driver);
                logger.info("Driver approval record created with PENDING status");
            }

            return savedUser;
        } catch (Exception e) {
            logger.severe("Registration failed: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Registration failed: " + e.getMessage());
        }
    }

    public AuthResponse login(AuthRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new RuntimeException("Invalid email or password");
        }

        String token = jwtTokenProvider.generateToken(user);

        AuthResponse response = new AuthResponse();
        response.setToken(token);
        response.setUser(user);
        return response;
    }
}