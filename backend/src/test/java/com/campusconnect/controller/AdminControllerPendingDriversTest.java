package com.campusconnect.controller;

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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
public class AdminControllerPendingDriversTest {

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

    private String testDriverEmail;
    private Long testDriverId;

    @BeforeEach
    public void setUp() {
        // Clean up test data
        testDriverEmail = "testdriver_" + System.currentTimeMillis() + "@spu.ac.za";
        
        // Create a test driver via the AuthService
        RegisterRequest request = new RegisterRequest();
        request.setFullName("Test Driver Approval");
        request.setEmail(testDriverEmail);
        request.setPassword("S1fund@24");
        request.setRole("DRIVER");
        request.setPhone("0700000000");
        request.setStudentNumber("20240999");
        request.setYearOfStudy(2);
        request.setEmergencyContact("0700000001");
        request.setLicencePlate("CC2024");
        request.setVehicleMake("Toyota");
        request.setVehicleYear(2023);
        
        User testDriver = authService.register(request);
        testDriverId = testDriver.getId();
        
        System.out.println("Test driver created: ID=" + testDriverId + ", Email=" + testDriverEmail);
    }

    @Test
    public void testGetPendingDriversViaAdminEndpoint() throws Exception {
        // Verify the driver was created with PENDING status
        Optional<User> user = userRepository.findById(testDriverId);
        assertTrue(user.isPresent(), "Test driver should exist in database");
        assertEquals(User.UserStatus.PENDING, user.get().getStatus(), 
            "Driver should have PENDING status");
        
        // Verify driver record exists with PENDING approval status
        Optional<Driver> driver = driverRepository.findByUserId(testDriverId);
        assertTrue(driver.isPresent(), "Driver record should exist");
        assertEquals(Driver.ApprovalStatus.PENDING, driver.get().getApprovalStatus(),
            "Driver approval status should be PENDING");
        
        System.out.println("Pre-check passed: Driver has PENDING status and approval record exists");
        
        // Now test if the admin endpoint returns this driver
        // Note: This endpoint doesn't require authentication based on the controller
        MvcResult result = mockMvc.perform(
            get("/api/admin/driver-approvals/pending")
        )
        .andExpect(status().isOk())
        .andReturn();
        
        String jsonResponse = result.getResponse().getContentAsString();
        System.out.println("Admin endpoint response: " + jsonResponse);
        
        // Parse the response - it should be a JSON array
        // We can't use Jackson here without the annotation, so let's check if our driver's email is in the response
        assertTrue(jsonResponse.contains(testDriverEmail),
            "Response should contain test driver email: " + testDriverEmail);
        assertTrue(jsonResponse.contains("PENDING"),
            "Response should contain PENDING status");
        
        System.out.println("✓ Test passed: Admin endpoint returns pending driver");
    }

    @Test
    public void testCountPendingDriversInDatabase() {
        // Count pending drivers using the repository
        long pendingCount = driverRepository.countByApprovalStatus(Driver.ApprovalStatus.PENDING);
        System.out.println("Total pending drivers in database: " + pendingCount);
        
        assertTrue(pendingCount > 0, "Should have at least one pending driver after test setup");
    }

    @Test
    public void testQueryPendingDriversDirectly() {
        // Query using the same SQL as the admin endpoint
        String sql = "SELECT d.driver_id AS driver_id, d.user_id AS user_id, u.full_name, u.email, u.student_number, " +
                "u.phone, u.year_of_study, d.licence_plate, d.vehicle_make, d.vehicle_year, u.created_at " +
                "FROM drivers d " +
                "LEFT JOIN users u ON u.user_id = d.user_id " +
                "WHERE d.approval_status = ? " +
                "ORDER BY u.created_at DESC";
        
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, "PENDING");
            System.out.println("Pending drivers in database: " + rows.size());
            
            for (Map<String, Object> row : rows) {
                System.out.println("  - " + row.get("full_name") + " (" + row.get("email") + ")");
            }
            
            assertTrue(rows.size() > 0, "Should have at least one pending driver in database");
            
            // Check if our test driver is in the results
            boolean found = rows.stream()
                .anyMatch(row -> testDriverEmail.equals(row.get("email")));
            assertTrue(found, "Test driver should be found in pending drivers list");
            
        } catch (Exception e) {
            System.err.println("Error querying pending drivers: " + e.getMessage());
            e.printStackTrace();
            fail("Should be able to query pending drivers");
        }
    }
}
