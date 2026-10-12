package com.campusconnect.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@EnableScheduling
public class VerifiedScheduledRideDispatcher {
    private final JdbcTemplate jdbc;
    public VerifiedScheduledRideDispatcher(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    // Dispatch remains available even if the rider has closed the app.
    @Scheduled(fixedDelay = 10000, initialDelay = 10000)
    public void dispatchDueVerifiedRides() {
        jdbc.update("UPDATE rides r SET r.status = 'PENDING', r.updated_at = NOW() "
            + "WHERE r.status = 'SCHEDULED' AND r.face_matched_at IS NOT NULL "
            + "AND r.scheduled_at IS NOT NULL AND r.scheduled_at <= NOW() "
            + "AND EXISTS (SELECT 1 FROM payments p WHERE p.ride_id = r.ride_id AND p.status IN ('PENDING', 'COMPLETED'))");
    }
}
