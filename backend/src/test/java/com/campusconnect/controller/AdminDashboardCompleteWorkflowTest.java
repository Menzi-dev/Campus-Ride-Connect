package com.campusconnect.controller;

import com.campusconnect.dto.AuthRequest;
import com.campusconnect.dto.AuthResponse;
import com.campusconnect.dto.RegisterRequest;
import com.campusconnect.entity.Driver;
import com.campusconnect.entity.User;
import com.campusconnect.repository.DriverRepository;
import com.campusconnect.repository.UserRepository;
import com.campusconnect.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
public class AdminDashboardCompleteWorkflowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DriverRepository driverRepository;

    @Autowired
    private AuthService authService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @Transactional
    public void testCompleteAdminApprovalWorkflow() throws Exception {
        System.out.println("\n" + "=".repeat(80));
        System.out.println("COMPLETE ADMIN APPROVAL WORKFLOW TEST");
        System.out.println("=".repeat(80) + "\n");
        
        // STEP 1: Create test driver
        System.out.println("[STEP 1] Creating test driver...");
        String testDriverEmail = "testdriver_complete_" + System.currentTimeMillis() + "@spu.ac.za";
        String testDriverPassword = "S1fund@24";
        
        RegisterRequest driverRequest = new RegisterRequest();
        driverRequest.setFullName("John Driver Complete");
        driverRequest.setEmail(testDriverEmail);
        driverRequest.setPassword(testDriverPassword);
        driverRequest.setRole("DRIVER");
        driverRequest.setPhone("0700000000");
        driverRequest.setStudentNumber("20240888");
        driverRequest.setYearOfStudy(2);
        driverRequest.setEmergencyContact("0700000001");
        driverRequest.setLicencePlate("JD2024");
        driverRequest.setVehicleMake("Ford");
        driverRequest.setVehicleYear(2023);
        
        User testDriver = authService.register(driverRequest);
        Long driverId = testDriver.getId();
        Long driverUserId = testDriver.getId();
        
        assertEquals(User.UserStatus.PENDING, testDriver.getStatus(), 
            "Driver should have PENDING status after registration");
        
        System.out.println("✓ Test driver created:");
        System.out.println("  - ID: " + driverId);
        System.out.println("  - Email: " + testDriverEmail);
        System.out.println("  - Status: " + testDriver.getStatus());
        
        // Verify driver approval record
        Optional<Driver> driverRecord = driverRepository.findByUserId(driverUserId);
        assertTrue(driverRecord.isPresent(), "Driver approval record should exist");
        assertEquals(Driver.ApprovalStatus.PENDING, driverRecord.get().getApprovalStatus(),
            "Driver approval status should be PENDING");
        Long driverRecordId = driverRecord.get().getId();
        System.out.println("  - Driver Record ID: " + driverRecordId);
        System.out.println("  - Approval Status: " + driverRecord.get().getApprovalStatus());
        
        // STEP 2: Create admin account
        System.out.println("\n[STEP 2] Creating admin account...");
        String adminEmail = "admin@spu.ac.za";
        String adminPassword = "S1fund@24";
        
        RegisterRequest adminRequest = new RegisterRequest();
        adminRequest.setFullName("Campus Admin");
        adminRequest.setEmail(adminEmail);
        adminRequest.setPassword(adminPassword);
        adminRequest.setRole("ADMIN");
        adminRequest.setPhone("0700000000");
        adminRequest.setStudentNumber("ADMIN001");
        adminRequest.setYearOfStudy(0);
        adminRequest.setEmergencyContact("0700000000");
        
        try {
            authService.register(adminRequest);
            System.out.println("✓ New admin account created");
        } catch (RuntimeException e) {
            if (e.getMessage().contains("already registered")) {
                System.out.println("✓ Admin account already exists (reusing)");
            } else {
                throw e;
            }
        }
        
        // STEP 3: Admin login
        System.out.println("\n[STEP 3] Admin login...");
        AuthRequest loginRequest = new AuthRequest();
        loginRequest.setEmail(adminEmail);
        loginRequest.setPassword(adminPassword);
        
        AuthResponse loginResponse = authService.login(loginRequest);
        String adminToken = loginResponse.getToken();
        User adminUser = loginResponse.getUser();
        
        assertEquals(User.Role.ADMIN, adminUser.getRole(), "User should have ADMIN role");
        assertNotNull(adminToken, "Token should be generated");
        System.out.println("✓ Admin login successful:");
        System.out.println("  - Email: " + adminEmail);
        System.out.println("  - Role: " + adminUser.getRole());
        System.out.println("  - Token: " + adminToken.substring(0, 30) + "...");
        
        // STEP 4: Admin views dashboard
        System.out.println("\n[STEP 4] Admin viewing dashboard stats...");
        MvcResult statsResult = mockMvc.perform(
            get("/api/admin/dashboard/stats")
                .header("Authorization", "Bearer " + adminToken)
        )
        .andExpect(status().isOk())
        .andReturn();
        
        String statsJson = statsResult.getResponse().getContentAsString();
        System.out.println("✓ Dashboard stats retrieved:");
        assertTrue(statsJson.contains("\"pendingApprovals\""), 
            "Stats should contain pendingApprovals");
        System.out.println("  - Stats response: " + statsJson.substring(0, 100) + "...");
        
        // STEP 5: Admin views pending driver approvals
        System.out.println("\n[STEP 5] Admin viewing pending driver approvals...");
        MvcResult approvalsResult = mockMvc.perform(
            get("/api/admin/driver-approvals/pending")
                .header("Authorization", "Bearer " + adminToken)
        )
        .andExpect(status().isOk())
        .andReturn();
        
        String approvalsJson = approvalsResult.getResponse().getContentAsString();
        System.out.println("✓ Pending approvals retrieved:");
        assertTrue(approvalsJson.contains(testDriverEmail),
            "Pending approvals should contain test driver email");
        System.out.println("  - Found test driver in pending list");
        
        // STEP 6: Admin approves the driver
        System.out.println("\n[STEP 6] Admin approving driver...");
        MvcResult approveResult = mockMvc.perform(
            post("/api/admin/driver-approvals/" + driverRecordId + "/approve")
                .header("Authorization", "Bearer " + adminToken)
        )
        .andExpect(status().isOk())
        .andReturn();
        
        String approveJson = approveResult.getResponse().getContentAsString();
        System.out.println("✓ Driver approved:");
        System.out.println("  - Response: " + approveJson);
        
        // STEP 7: Verify driver status changed
        System.out.println("\n[STEP 7] Verifying driver status after approval...");
        User updatedDriver = userRepository.findById(driverId).orElseThrow();
        Optional<Driver> updatedDriverRecord = driverRepository.findByUserId(driverId);
        
        assertEquals(User.UserStatus.ACTIVE, updatedDriver.getStatus(),
            "Driver should have ACTIVE status after approval");
        assertTrue(updatedDriverRecord.isPresent(), "Driver record should still exist");
        assertEquals(Driver.ApprovalStatus.APPROVED, updatedDriverRecord.get().getApprovalStatus(),
            "Driver approval status should be APPROVED after approval");
        
        System.out.println("✓ Driver status successfully changed:");
        System.out.println("  - User Status: " + updatedDriver.getStatus());
        System.out.println("  - Approval Status: " + updatedDriverRecord.get().getApprovalStatus());
        
        // STEP 8: Verify driver is no longer in pending list
        System.out.println("\n[STEP 8] Verifying driver removed from pending list...");
        MvcResult updatedApprovalsResult = mockMvc.perform(
            get("/api/admin/driver-approvals/pending")
                .header("Authorization", "Bearer " + adminToken)
        )
        .andExpect(status().isOk())
        .andReturn();
        
        String updatedApprovalsJson = updatedApprovalsResult.getResponse().getContentAsString();
        assertFalse(updatedApprovalsJson.contains("\"email\":\"" + testDriverEmail + "\"") && 
                    updatedApprovalsJson.contains("PENDING"),
            "Approved driver should not appear in pending list");
        System.out.println("✓ Driver removed from pending approvals list");
        
        System.out.println("\n" + "=".repeat(80));
        System.out.println("✓ COMPLETE WORKFLOW TEST PASSED!");
        System.out.println("=".repeat(80));
        System.out.println("\nSummary:");
        System.out.println("1. Driver registered with PENDING status");
        System.out.println("2. Admin account created/verified");
        System.out.println("3. Admin logged in and retrieved pending drivers");
        System.out.println("4. Admin approved the driver");
        System.out.println("5. Driver status changed to ACTIVE");
        System.out.println("6. Driver removed from pending list");
        System.out.println("\n" + "=".repeat(80) + "\n");
    }
}
