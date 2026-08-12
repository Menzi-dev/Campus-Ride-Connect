package com.campusconnect.controller;

import com.campusconnect.dto.AuthRequest;
import com.campusconnect.dto.AuthResponse;
import com.campusconnect.dto.RegisterRequest;
import com.campusconnect.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
public class CreateAdminAccountTest {

    @Autowired
    private AuthService authService;

    @Test
    public void createDefaultAdminAccount() {
        /**
         * This test creates the admin account that the mobile app expects:
         * Email: admin@spu.ac.za
         * Password: admin12345 (note: mobile app checks this hardcoded password)
         * 
         * Once this test runs successfully, the admin can:
         * 1. Login to mobile app with these credentials
         * 2. Access the AdminDashboardScreen
         * 3. See the list of pending driver approvals
         * 4. Approve or reject drivers
         */
        
        String adminEmail = "admin@spu.ac.za";
        String adminPassword = "admin12345";
        
        System.out.println("\n" + "=".repeat(80));
        System.out.println("CREATING DEFAULT ADMIN ACCOUNT FOR MOBILE APP");
        System.out.println("=".repeat(80));
        System.out.println("Email: " + adminEmail);
        System.out.println("Password: " + adminPassword);
        System.out.println("Note: This matches the hardcoded credentials in mobile LoginScreen.tsx");
        System.out.println("=".repeat(80) + "\n");
        
        try {
            // Register admin with the credentials the mobile app expects
            RegisterRequest request = new RegisterRequest();
            request.setFullName("Campus Admin");
            request.setEmail(adminEmail);
            request.setPassword(adminPassword);
            request.setRole("ADMIN");
            request.setPhone("0700000000");
            request.setStudentNumber("ADMIN001");
            request.setYearOfStudy(0);
            request.setEmergencyContact("0700000000");
            
            System.out.println("Registering admin user...");
            authService.register(request);
            System.out.println("✓ Admin user registered successfully");
            
            // Verify login works
            System.out.println("\nVerifying admin can login...");
            AuthRequest loginRequest = new AuthRequest();
            loginRequest.setEmail(adminEmail);
            loginRequest.setPassword(adminPassword);
            
            AuthResponse response = authService.login(loginRequest);
            assertNotNull(response.getToken(), "Token should not be null");
            System.out.println("✓ Admin login successful");
            System.out.println("✓ JWT token generated: " + response.getToken().substring(0, 50) + "...");
            System.out.println("\n" + "=".repeat(80));
            System.out.println("SUCCESS! Admin account is ready.");
            System.out.println("\nNext steps:");
            System.out.println("1. Open the mobile app");
            System.out.println("2. Click 'Register / Login'");
            System.out.println("3. Select 'University Admin'");
            System.out.println("4. Enter email: " + adminEmail);
            System.out.println("5. Enter password: " + adminPassword);
            System.out.println("6. Click Sign In");
            System.out.println("7. You should now see the AdminDashboardScreen with pending drivers");
            System.out.println("=".repeat(80) + "\n");
            
        } catch (RuntimeException e) {
            if (e.getMessage().contains("already registered")) {
                System.out.println("⚠ Admin account already exists. This is OK - using existing account.");
                
                // Verify login still works
                System.out.println("Verifying login works...");
                AuthRequest loginRequest = new AuthRequest();
                loginRequest.setEmail(adminEmail);
                loginRequest.setPassword(adminPassword);
                
                AuthResponse response = authService.login(loginRequest);
                assertNotNull(response.getToken(), "Token should not be null");
                System.out.println("✓ Admin login successful");
                System.out.println("\n" + "=".repeat(80));
                System.out.println("Admin account is ready for use.");
                System.out.println("=".repeat(80) + "\n");
            } else {
                System.out.println("✗ Error creating admin account: " + e.getMessage());
                throw e;
            }
        }
    }
}
