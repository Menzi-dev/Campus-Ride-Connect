package com.campusconnect.controller;

import com.campusconnect.entity.Driver;
import com.campusconnect.entity.User;
import com.campusconnect.repository.DriverRepository;
import com.campusconnect.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@WithMockUser(roles = "ADMIN")
class NewDriverApprovalWorkflowTest {
    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper mapper;
    @Autowired private UserRepository users;
    @Autowired private DriverRepository drivers;
    @Autowired private JdbcTemplate jdbc;

    @Test
    void multipartRegistrationAppearsInAdminQueueAndCanBeApproved() throws Exception {
        verifyDecision("approve", Driver.ApprovalStatus.APPROVED, User.UserStatus.ACTIVE);
    }

    @Test
    void multipartRegistrationCanBeRejectedAndLeavesQueue() throws Exception {
        verifyDecision("reject", Driver.ApprovalStatus.REJECTED, User.UserStatus.SUSPENDED);
    }

    private void verifyDecision(String decision, Driver.ApprovalStatus approvalStatus, User.UserStatus userStatus) throws Exception {
        assertEquals("campus_connect_tests", jdbc.queryForObject("SELECT DATABASE()", String.class));
        String email = "new-registration-" + decision + "@example.test";
        String response = mvc.perform(multipart("/api/auth/register")
                .param("fullName", "Newly Registered Driver")
                .param("email", email).param("password", "Registration-check-123")
                .param("role", "DRIVER").param("studentNumber", "20260001")
                .param("phone", "0700000000").param("yearOfStudy", "2")
                .param("licencePlate", "NEW123").param("vehicleMake", "Toyota")
                .param("vehicleYear", "2024"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long userId = mapper.readTree(response).path("user").path("id").asLong();
        assertTrue(userId > 0);
        assertEquals(User.UserStatus.PENDING, users.findById(userId).orElseThrow().getStatus());

        JsonNode pending = mapper.readTree(mvc.perform(get("/api/admin/driver-approvals/pending"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        JsonNode application = null;
        for (JsonNode row : pending) if (email.equals(row.path("email").asText())) application = row;
        assertNotNull(application, "A newly registered driver must be visible for admin review");
        long driverId = application.path("id").asLong();
        assertEquals(User.Role.DRIVER, users.findById(userId).orElseThrow().getRole());

        mvc.perform(post("/api/admin/driver-approvals/" + driverId + "/" + decision))
                .andExpect(status().isOk());
        assertEquals(approvalStatus, drivers.findById(driverId).orElseThrow().getApprovalStatus());
        assertEquals(userStatus, users.findById(userId).orElseThrow().getStatus());
        // This test rolls back its outer transaction; expose JPA updates to the JDBC queue query.
        drivers.flush();
        users.flush();
        JsonNode remaining = mapper.readTree(mvc.perform(get("/api/admin/driver-approvals/pending"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        for (JsonNode row : remaining) assertNotEquals(email, row.path("email").asText());
    }
}
