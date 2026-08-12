package com.campusconnect.controller;

import com.campusconnect.entity.Driver;
import com.campusconnect.repository.DriverRepository;
import com.campusconnect.repository.RideRepository;
import com.campusconnect.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminControllerRouteTest {

    @Test
    void adminDashboardStatsLegacyRouteShouldReturnStats() {
        UserRepository userRepository = mock(UserRepository.class);
        RideRepository rideRepository = mock(RideRepository.class);
        DriverRepository driverRepository = mock(DriverRepository.class);
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);

        when(userRepository.count()).thenReturn(12L);
        when(userRepository.countByRole(com.campusconnect.entity.User.Role.DRIVER)).thenReturn(5L);
        when(driverRepository.countByApprovalStatus(Driver.ApprovalStatus.PENDING)).thenReturn(2L);
        when(jdbcTemplate.queryForObject(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any(Object[].class),
                org.mockito.ArgumentMatchers.eq(Integer.class)))
                .thenReturn(9);

        AdminController controller = new AdminController(userRepository, rideRepository, driverRepository, jdbcTemplate);

        ResponseEntity<Map<String, Object>> response = controller.getDashboardStatsLegacy();

        assertEquals(200, response.getStatusCode().value());
        assertEquals(12L, response.getBody().get("totalUsers"));
        assertEquals(5L, response.getBody().get("totalDrivers"));
        assertEquals(9, response.getBody().get("ridesToday"));
    }

    @Test
    void adminPendingApprovalsLegacyRouteShouldReturnApprovalPayload() {
        UserRepository userRepository = mock(UserRepository.class);
        RideRepository rideRepository = mock(RideRepository.class);
        DriverRepository driverRepository = mock(DriverRepository.class);
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);

        when(jdbcTemplate.queryForList(
                org.mockito.ArgumentMatchers.contains("FROM drivers d"),
                org.mockito.ArgumentMatchers.eq(Driver.ApprovalStatus.PENDING.name())))
                .thenReturn(List.of(new java.util.HashMap<>() {{
                    put("driver_id", 101L);
                    put("user_id", 77L);
                    put("full_name", "Ada Admin");
                    put("email", "ada@spu.ac.za");
                    put("student_number", "20240077");
                    put("phone", "0712345678");
                    put("year_of_study", 3);
                    put("licence_plate", "ABC123GP");
                    put("vehicle_make", "Toyota");
                    put("vehicle_year", 2023);
                    put("created_at", "2026-08-12T21:00:00");
                }}));

        AdminController controller = new AdminController(userRepository, rideRepository, driverRepository, jdbcTemplate);

        ResponseEntity<List<Map<String, Object>>> response = controller.getPendingDriverApprovalsLegacy();

        assertEquals(200, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals(1, response.getBody().size());
        assertEquals("101", response.getBody().get(0).get("id"));
        assertEquals("77", response.getBody().get(0).get("userId"));
        assertEquals("DRIVER", response.getBody().get(0).get("role"));
    }
}
