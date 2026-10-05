package com.campusconnect.controller;

import com.campusconnect.entity.Ride;
import com.campusconnect.entity.User;
import com.campusconnect.repository.RideRepository;
import com.campusconnect.repository.SosAlertRepository;
import com.campusconnect.repository.UserRepository;
import com.campusconnect.security.JwtTokenProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Local test database only. No notifications, real audio or security dispatch. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class DriverSosWorkflowTest {
    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper mapper;
    @Autowired private UserRepository users;
    @Autowired private RideRepository rides;
    @Autowired private SosAlertRepository alerts;
    @Autowired private JwtTokenProvider tokens;
    @Autowired private JdbcTemplate jdbc;

    private User account(User.Role role, String name) {
        User user = new User();
        user.setRole(role);
        user.setStatus(User.UserStatus.ACTIVE);
        user.setFullName(name);
        user.setEmail(UUID.randomUUID() + "@example.test");
        user.setPasswordHash("Synthetic fixture; not a login password");
        return users.saveAndFlush(user);
    }

    @Test
    void assignedDriverSosAndEvidenceReachSecurityAndOutsidersAreBlocked() throws Exception {
        assertEquals("campus_connect_tests", jdbc.queryForObject("SELECT DATABASE()", String.class));
        User rider = account(User.Role.RIDER, "Fixture rider");
        User driver = account(User.Role.DRIVER, "Fixture driver");
        User security = account(User.Role.SECURITY, "Fixture security");
        User outsider = account(User.Role.DRIVER, "Unassigned driver");
        Ride ride = new Ride();
        ride.setRiderId(rider.getId());
        ride.setDriverId(driver.getId());
        ride.setStatus(Ride.RideStatus.STARTED);
        ride.setPickupLocation("Fixture campus");
        ride.setDestination("Fixture accommodation");
        ride = rides.saveAndFlush(ride);
        String driverToken = "Bearer " + tokens.generateToken(driver);
        String securityToken = "Bearer " + tokens.generateToken(security);
        String outsiderToken = "Bearer " + tokens.generateToken(outsider);

        long before = alerts.count();
        mvc.perform(post("/api/rides/" + ride.getId() + "/sos")
                .header("Authorization", outsiderToken).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
        assertEquals(before, alerts.count());

        String response = mvc.perform(post("/api/rides/" + ride.getId() + "/sos")
                .header("Authorization", driverToken).contentType(MediaType.APPLICATION_JSON)
                .content("{\"gpsLat\":-28.745,\"gpsLng\":24.77}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long alertId = mapper.readTree(response).path("alertId").asLong();
        var alert = alerts.findById(alertId).orElseThrow();
        assertEquals(driver.getId(), alert.getTriggeredBy());
        assertEquals(ride.getId(), alert.getRideId());
        assertEquals(-28.745, alert.getGpsLat());
        assertEquals(24.77, alert.getGpsLng());

        byte[] evidence = "Synthetic evidence bytes".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        Path audio = Files.createTempFile(Path.of("target"), "driver-sos-evidence-", ".webm");
        try {
            Files.write(audio, evidence);
            alert.setAudioFilePath(audio.toAbsolutePath().toString());
            alert.setRecordingDuration(5);
            alerts.saveAndFlush(alert);
            JsonNode active = mapper.readTree(mvc.perform(get("/api/security/sos").header("Authorization", securityToken))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("active");
            JsonNode reported = null;
            for (JsonNode row : active) if (row.path("id").asLong() == alertId) reported = row;
            assertNotNull(reported, "Driver SOS must appear in Security's existing active alerts");
            assertEquals("DRIVER", reported.path("triggeredByRole").asText());
            assertEquals("Fixture driver", reported.path("triggeredByName").asText());
            assertEquals(driver.getId().longValue(), reported.path("triggeredBy").asLong());
            assertTrue(reported.path("hasAudio").asBoolean());
            mvc.perform(get("/api/security/sos/" + alertId + "/audio").header("Authorization", securityToken))
                    .andExpect(status().isOk()).andExpect(content().bytes(evidence));
            mvc.perform(get("/api/security/sos/" + alertId + "/audio").header("Authorization", driverToken))
                    .andExpect(status().isForbidden());
            mvc.perform(multipart("/api/rides/" + ride.getId() + "/sos/" + alertId + "/audio")
                    .file(new MockMultipartFile("audio", "fixture.webm", "audio/webm", evidence))
                    .param("duration", "5").header("Authorization", outsiderToken)
                    .with(request -> { request.setMethod("PUT"); return request; }))
                    .andExpect(status().isForbidden());
            assertArrayEquals(evidence, Files.readAllBytes(audio));
        } finally { Files.deleteIfExists(audio); }

        // The rider keeps using the very same endpoint and Security queue.
        mvc.perform(post("/api/rides/" + ride.getId() + "/sos")
                .header("Authorization", "Bearer " + tokens.generateToken(rider))
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk());
        assertEquals(before + 2, alerts.count());
    }
}
