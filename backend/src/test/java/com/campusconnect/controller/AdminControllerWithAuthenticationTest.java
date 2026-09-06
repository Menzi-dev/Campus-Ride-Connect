package com.campusconnect.controller;

import com.campusconnect.dto.AuthRequest;
import com.campusconnect.dto.AuthResponse;
import com.campusconnect.dto.RegisterRequest;
import com.campusconnect.entity.Driver;
import com.campusconnect.entity.User;
import com.campusconnect.repository.DriverRepository;
import com.campusconnect.repository.UserRepository;
import com.campusconnect.service.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
public class AdminControllerWithAuthenticationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DriverRepository driverRepository;

    @Autowired
    private AuthService authService;

    private String adminToken;
    private String testDriverEmail;
    private Long testDriverId;

    @BeforeEach
    public void setUp() {
        // Create a test driver
        testDriverEmail = "testdriver_auth_" + System.currentTimeMillis() + "@spu.ac.za";
        
        RegisterRequest driverRequest = new RegisterRequest();
        driverRequest.setFullName("Test Driver Auth");
        driverRequest.setEmail(testDriverEmail);
        driverRequest.setPassword("S1fund@24");
        driverRequest.setRole("DRIVER");
        driverRequest.setPhone("0700000000");
        driverRequest.setStudentNumber("20240999");
        driverRequest.setYearOfStudy(2);
        driverRequest.setEmergencyContact("0700000001");
        driverRequest.setLicencePlate("CC2024");
        driverRequest.setVehicleMake("Toyota");
        driverRequest.setVehicleYear(2023);
        
        User testDriver = authService.register(driverRequest);
        testDriverId = testDriver.getId();
        System.out.println("Test driver created: ID=" + testDriverId + ", Email=" + testDriverEmail + ", Status=" + testDriver.getStatus());
        
        // Create an admin user
        String adminEmail = "admin_auth_" + System.currentTimeMillis() + "@spu.ac.za";
        RegisterRequest adminRequest = new RegisterRequest();
        adminRequest.setFullName("Test Admin");
        adminRequest.setEmail(adminEmail);
        adminRequest.setPassword("S1fund@24");
        adminRequest.setRole("ADMIN");
        adminRequest.setPhone("0700000000");
        adminRequest.setStudentNumber("00000000");
        adminRequest.setYearOfStudy(0);
        adminRequest.setEmergencyContact("0700000000");
        
        User adminUser = authService.register(adminRequest);
        System.out.println("Admin user created: ID=" + adminUser.getId() + ", Email=" + adminEmail + ", Role=" + adminUser.getRole());
        
        // Login as admin to get token
        AuthRequest loginRequest = new AuthRequest();
        loginRequest.setEmail(adminEmail);
        loginRequest.setPassword("S1fund@24");
        
        AuthResponse loginResponse = authService.login(loginRequest);
        adminToken = loginResponse.getToken();
        System.out.println("Admin token generated: " + adminToken.substring(0, 30) + "...");
    }

    @Test
    public void testAdminDashboardStatsWithAuth() throws Exception {
        // Test accessing admin/dashboard/stats with authentication
        MvcResult result = mockMvc.perform(
            get("/api/admin/dashboard/stats")
                .header("Authorization", "Bearer " + adminToken)
        )
        .andExpect(status().isOk())
        .andReturn();
        
        String jsonResponse = result.getResponse().getContentAsString();
        System.out.println("Dashboard stats response: " + jsonResponse);
        
        assertTrue(jsonResponse.contains("\"totalUsers\""),
            "Response should contain totalUsers");
        assertTrue(jsonResponse.contains("\"totalDrivers\""),
            "Response should contain totalDrivers");
        assertTrue(jsonResponse.contains("\"pendingApprovals\""),
            "Response should contain pendingApprovals count");
        
        System.out.println("✓ Admin can access dashboard stats");
    }

    @Test
    public void testGetPendingDriversWithAdminAuth() throws Exception {
        // Test accessing /admin/driver-approvals/pending with admin authentication
        MvcResult result = mockMvc.perform(
            get("/api/admin/driver-approvals/pending")
                .header("Authorization", "Bearer " + adminToken)
        )
        .andExpect(status().isOk())
        .andReturn();
        
        String jsonResponse = result.getResponse().getContentAsString();
        System.out.println("Pending approvals response: " + jsonResponse);
        
        // Response should contain the test driver email
        assertTrue(jsonResponse.contains(testDriverEmail),
            "Response should contain test driver email: " + testDriverEmail);
        
        System.out.println("✓ Admin can access pending drivers list with authentication");
    }

    @Test
    public void testAdminCannotAccessWithoutAuth() throws Exception {
        // Test that accessing without token returns 403
        mockMvc.perform(
            get("/api/admin/driver-approvals/pending")
        )
        .andExpect(status().isForbidden())
        .andReturn();
        
        System.out.println("✓ Endpoint correctly denies access without authentication");
    }

    @Test
    public void testNonAdminCannotAccessAdminEndpoint() throws Exception {
        // Create a non-admin user (DRIVER)
        RegisterRequest driverRequest = new RegisterRequest();
        String driverEmail = "driver_nonadmin_" + System.currentTimeMillis() + "@spu.ac.za";
        driverRequest.setFullName("Non-Admin Driver");
        driverRequest.setEmail(driverEmail);
        driverRequest.setPassword("S1fund@24");
        driverRequest.setRole("DRIVER");
        driverRequest.setPhone("0700000000");
        driverRequest.setStudentNumber("20240888");
        driverRequest.setYearOfStudy(1);
        driverRequest.setEmergencyContact("0700000001");
        driverRequest.setLicencePlate("XX1111");
        driverRequest.setVehicleMake("Honda");
        driverRequest.setVehicleYear(2022);
        
        User driver = authService.register(driverRequest);
        
        // Get token for driver
        AuthRequest loginRequest = new AuthRequest();
        loginRequest.setEmail(driverEmail);
        loginRequest.setPassword("S1fund@24");
        AuthResponse loginResponse = authService.login(loginRequest);
        String driverToken = loginResponse.getToken();
        
        System.out.println("Non-admin driver created and logged in, attempting to access admin endpoint...");
        
        // Try to access admin endpoint as driver (should be 403)
        mockMvc.perform(
            get("/api/admin/driver-approvals/pending")
                .header("Authorization", "Bearer " + driverToken)
        )
        .andExpect(status().isForbidden())
        .andReturn();
        
        System.out.println("✓ Non-admin user correctly denied access to admin endpoint");
    }
}
