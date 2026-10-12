package com.campusconnect.controller;

import com.campusconnect.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.time.LocalDate;
import java.time.ZoneId;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AdminDashboardAccuracyTest {
    private final UserRepository users = mock(UserRepository.class);
    private final DriverRepository drivers = mock(DriverRepository.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final AdminController controller = new AdminController(users, mock(RideRepository.class), drivers, jdbc, mock(com.campusconnect.service.DriverDecisionEmailService.class));
    private void counts(long sos, long completed, long free) {
        when(users.count()).thenReturn(95L);
        when(users.countByRole(com.campusconnect.entity.User.Role.DRIVER)).thenReturn(56L);
        when(jdbc.queryForObject(contains("created_at >="), any(Object[].class), eq(Integer.class))).thenReturn(7);
        when(jdbc.queryForObject(contains("FROM sos_alerts WHERE"), eq(Long.class))).thenReturn(sos);
        when(jdbc.queryForObject(eq("SELECT COUNT(*) FROM rides WHERE status = 'COMPLETED'"), eq(Long.class))).thenReturn(completed);
        when(jdbc.queryForObject(contains("NOT EXISTS"), eq(Long.class))).thenReturn(free);
    }
    @Test void liveCountsReplaceHardcodedSosAndSafetyFigures() {
        counts(2, 4, 3);
        var result = controller.getStats();
        assertEquals(200, result.getStatusCode().value());
        assertEquals(2L, result.getBody().get("activeSOS"));
        assertEquals(75.0, result.getBody().get("safetyScorePercent"));
        assertEquals(4L, result.getBody().get("completedRides"));
    }
    @Test void noCompletedTripsMeansNoPercentage() {
        counts(0, 0, 0);
        assertNull(controller.getStats().getBody().get("safetyScorePercent"));
    }
    @Test void todayUsesSouthAfricanMidnightAndExclusiveNextMidnight() {
        counts(0, 0, 0); controller.getStats();
        var bounds = org.mockito.ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).queryForObject(contains("created_at >= ? AND created_at < ?"), bounds.capture(), eq(Integer.class));
        var today = LocalDate.now(ZoneId.of("Africa/Johannesburg"));
        assertEquals(Timestamp.valueOf(today.atStartOfDay()), bounds.getValue()[0]);
        assertEquals(Timestamp.valueOf(today.plusDays(1).atStartOfDay()), bounds.getValue()[1]);
    }
    @Test void databaseFailureDoesNotInventZeroCounts() {
        counts(0, 0, 0);
        when(users.count()).thenThrow(new IllegalStateException("Database unavailable"));
        var result = controller.getStats();
        assertEquals(503, result.getStatusCode().value());
        assertFalse(result.getBody().containsKey("totalUsers"));
    }
    @Test void failedApprovalsDoNotDisplayAllCaughtUp() {
        counts(0, 0, 0);
        when(jdbc.queryForList(contains("FROM drivers d"), eq("PENDING"))).thenThrow(new IllegalStateException("Query failed"));
        var result = controller.getDashboard();
        assertEquals(503, result.getStatusCode().value());
        assertFalse(result.getBody().containsKey("approvals"));
    }
    @Test void snapshotPendingCountMatchesDisplayedApplications() {
        counts(0, 0, 0);
        when(jdbc.queryForList(contains("FROM drivers d"), eq("PENDING")))
            .thenReturn(List.of(Map.of("driver_id", 42L, "user_id", 7L, "full_name", "Test Driver", "created_at", "2026-01-01T00:00:00")));
        var result = controller.getDashboard();
        var stats = (Map<?, ?>)result.getBody().get("stats");
        assertEquals(1, stats.get("pendingApprovals"));
    }
}
