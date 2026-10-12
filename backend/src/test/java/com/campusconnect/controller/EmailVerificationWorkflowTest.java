package com.campusconnect.controller;
import com.campusconnect.entity.User;
import com.campusconnect.repository.UserRepository;
import com.campusconnect.service.EmailVerificationService;
import com.campusconnect.security.JwtTokenProvider;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@RecordApplicationEvents
class EmailVerificationWorkflowTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired JwtTokenProvider jwt;
    @Autowired ApplicationEvents events;
    @Autowired com.campusconnect.service.AuthService auth;
    @Autowired com.campusconnect.repository.EmailVerificationTokenRepository tokens;
    @Test void driverRegistrationSkipsEmailVerificationAndAllowsPendingStatusPage() throws Exception {
        String address = "driver_no_otp_" + System.nanoTime() + "@example.com";
        var result = mvc.perform(post("/api/auth/register").contentType("application/json").content(json.writeValueAsString(Map.of(
            "fullName", "Pending Driver", "email", address, "password", "Password123!", "role", "DRIVER"))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.emailVerificationRequired").value(false))
            .andExpect(jsonPath("$.user.status").value("PENDING")).andExpect(jsonPath("$.token").isNotEmpty())
            .andReturn().getResponse().getContentAsString();
        User user = users.findByEmail(address).orElseThrow();
        assertFalse(user.requiresEmailVerification());
        assertTrue(tokens.findByUserId(user.getId()).isEmpty());
        assertEquals(0, events.stream(EmailVerificationService.VerificationMail.class).count());
        String token = json.readTree(result).path("token").asText();
        mvc.perform(get("/api/users/" + user.getId() + "/status").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.approved").value(false));
        mvc.perform(post("/api/auth/login").contentType("application/json").content(json.writeValueAsString(Map.of(
            "email", address, "password", "Password123!")))).andExpect(status().isOk());
        mvc.perform(post("/api/auth/email-verification/resend").contentType("application/json")
            .content(json.writeValueAsString(Map.of("email", address)))).andExpect(status().isOk());
        assertEquals(0, events.stream(EmailVerificationService.VerificationMail.class).count());
    }
    @Test void verificationCodeCountsFailuresAndGrantsAccessOnlyAfterSuccessfulConfirmation() throws Exception {
        var request = new com.campusconnect.dto.RegisterRequest();
        String address = "code_" + System.nanoTime() + "@example.com";
        request.setFullName("Code Verification Test"); request.setEmail(address); request.setRole("RIDER"); request.setPassword("Password123!");
        User user = auth.register(request);
        var email = events.stream(EmailVerificationService.VerificationMail.class).findFirst().orElseThrow();
        String wrong = email.code().equals("000000") ? "111111" : "000000";
        mvc.perform(post("/api/auth/email-verification/confirm-code").contentType("application/json")
            .content(json.writeValueAsString(Map.of("email", address, "code", wrong)))).andExpect(status().isBadRequest());
        assertEquals(1, tokens.findByUserId(user.getId()).orElseThrow().getCodeAttempts());
        assertFalse(user.isEmailVerified());
        String confirmation = json.writeValueAsString(Map.of("email", address, "code", email.code()));
        mvc.perform(post("/api/auth/email-verification/confirm-code").contentType("application/json").content(confirmation)).andExpect(status().isOk());
        assertTrue(user.isEmailVerified());
        mvc.perform(post("/api/auth/email-verification/confirm-code").contentType("application/json").content(confirmation)).andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/email-verification/confirm").contentType("application/json")
            .content(json.writeValueAsString(Map.of("token", email.token())))).andExpect(status().isBadRequest());
    }
    @Test void registrationVerificationLoginAndReuseAreEnforcedOnBackend() throws Exception {
        String address = "verify_" + System.nanoTime() + "@example.com";
        mvc.perform(post("/api/auth/register").contentType("application/json").content(json.writeValueAsString(Map.of(
            "fullName", "Verification Test", "email", address, "password", "Password123!", "role", "RIDER"))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.emailVerificationRequired").value(true))
            .andExpect(jsonPath("$.user.emailVerified").value(false)).andExpect(jsonPath("$.user.passwordHash").doesNotExist());
        User user = users.findByEmail(address).orElseThrow();
        String credentials = json.writeValueAsString(Map.of("email", address, "password", "Password123!"));
        mvc.perform(post("/api/auth/login").contentType("application/json").content(credentials))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED"));
        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + jwt.generateToken(user)))
            .andExpect(status().isForbidden());
        var request = events.stream(EmailVerificationService.VerificationMail.class).findFirst().orElseThrow();
        String confirmation = json.writeValueAsString(Map.of("token", request.token()));
        mvc.perform(post("/api/auth/email-verification/confirm").contentType("application/json").content(confirmation)).andExpect(status().isOk());
        assertTrue(users.findByEmail(address).orElseThrow().isEmailVerified());
        mvc.perform(post("/api/auth/login").contentType("application/json").content(credentials)).andExpect(status().isOk());
        mvc.perform(post("/api/auth/email-verification/confirm").contentType("application/json").content(confirmation)).andExpect(status().isBadRequest());
    }
    @Test void unknownAndVerifiedResendHaveSameGenericResponse() throws Exception {
        var legacy = new User(); legacy.setFullName("Legacy User"); legacy.setEmail("legacy_" + System.nanoTime() + "@example.com");
        legacy.setPasswordHash("test-hash"); legacy.setRole(User.Role.RIDER); users.save(legacy);
        String known = mvc.perform(post("/api/auth/email-verification/resend").contentType("application/json")
            .content(json.writeValueAsString(Map.of("email", legacy.getEmail())))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String unknown = mvc.perform(post("/api/auth/email-verification/resend").contentType("application/json")
            .content("{\"email\":\"unknown@example.com\"}")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertEquals(known, unknown); assertTrue(legacy.isEmailVerified());
    }
}
