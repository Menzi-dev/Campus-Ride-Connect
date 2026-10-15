// Campus security API: provide ride and SOS information, record an alert response and return
// available audio evidence.
// Where: SecurityController handles /api/security; @GetMapping/@PostMapping/@PutMapping identify
// the actions below.
// How: Spring reads request fields/path IDs, invokes these controller methods and returns their
// ResponseEntity. Service/repository/JDBC calls inside the methods perform the actual work.
package com.campusconnect.controller;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Provides the security ride feed, SOS queue, incident evidence and alert-response actions. */
@RestController
@RequestMapping("/api/security")
@CrossOrigin(origins = "*")
public class SecurityController {
    private final JdbcTemplate jdbcTemplate;

    public SecurityController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    // Feature: Return the security dashboard counts from the current rides and alerts.
    // Where: SecurityController.dashboard() below.
    // How: dashboard() calls rideRows() and activeSosRows() in this class to carry out the
    // operation. Any failed checks stop the operation with the exception shown below.
    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> dashboard() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("activeRides", rideRows());
        response.put("activeSos", activeSosRows());
        response.put("resolvedSos", resolvedSosRows());
        return ResponseEntity.ok(response);
    }

    // Feature: Return the ride records used by the security monitoring screen.
    // Where: SecurityController.rides() below.
    // How: rides() calls rideRows() in this class to carry out the operation. Any failed checks
    // stop the operation with the exception shown below.
    @GetMapping("/rides")
    public ResponseEntity<List<Map<String, Object>>> rides() {
        return ResponseEntity.ok(rideRows());
    }

    // Feature: Return the active and resolved SOS records for the security screens.
    // Where: SecurityController.sos() below.
    // How: sos() calls activeSosRows() and resolvedSosRows() in this class to carry out the
    // operation. Any failed checks stop the operation with the exception shown below.
    @GetMapping("/sos")
    public ResponseEntity<Map<String, Object>> sos() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("active", activeSosRows());
        response.put("resolved", resolvedSosRows());
        return ResponseEntity.ok(response);
    }

    // Feature: Record the selected security response action for an SOS alert.
    // Where: SecurityController.dispatch() below.
    // How: dispatch() uses jdbcTemplate.update() to read, validate or save the data for this
    // operation. The return/exception handling below supplies its result to the caller.
    @PostMapping("/sos/{id}/dispatch")
    public ResponseEntity<?> dispatch(@PathVariable Long id) {
        int updated = jdbcTemplate.update(
                "UPDATE sos_alerts SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP WHERE alert_id = ? AND status NOT IN ('RESOLVED', 'CLOSED')",
                id);
        if (updated == 0) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("success", true, "message", "Dispatch unit sent to location", "alertId", id));
    }

    // Feature: Return the recorded audio evidence when the alert has an available file.
    // Where: SecurityController.audio() below.
    // How: audio() uses jdbcTemplate.queryForList() to read, validate or save the data for this
    // operation. The return/exception handling below supplies its result to the caller.
    @GetMapping("/sos/{id}/audio")
    public ResponseEntity<Resource> audio(@PathVariable Long id) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT audio_file_path FROM sos_alerts WHERE alert_id = ?", id);
        if (rows.isEmpty() || rows.get(0).get("audio_file_path") == null) return ResponseEntity.notFound().build();
        Path path = Paths.get(rows.get(0).get("audio_file_path").toString());
        if (!Files.isRegularFile(path)) return ResponseEntity.notFound().build();
        try {
            String contentType = Files.probeContentType(path);
            MediaType mediaType = contentType == null ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(contentType);
            return ResponseEntity.ok().contentType(mediaType).body(new FileSystemResource(path));
        } catch (Exception error) {
            return ResponseEntity.ok().contentType(MediaType.APPLICATION_OCTET_STREAM).body(new FileSystemResource(path));
        }
    }

    // Feature: Join ride and account information for the security ride list.
    // Where: SecurityController.rideRows() below.
    // How: rideRows() uses jdbcTemplate.queryForList() to read, validate or save the data for this
    // operation. The return/exception handling below supplies its result to the caller.
    private List<Map<String, Object>> rideRows() {
        String sql = "SELECT r.ride_id, r.status, r.pickup_location, r.destination, r.pickup_lat, r.pickup_lng, r.dest_lat, r.dest_lng, r.current_lat, r.current_lng, "
            + "r.created_at, rider.full_name AS rider_name, rider.phone AS rider_phone, driver.full_name AS driver_name, driver.phone AS driver_phone, "
                + "s.alert_id, s.status AS sos_status, s.gps_lat AS sos_lat, s.gps_lng AS sos_lng "
                + "FROM rides r LEFT JOIN users rider ON rider.user_id = r.rider_id LEFT JOIN users driver ON driver.user_id = r.driver_id "
                + "LEFT JOIN sos_alerts s ON s.alert_id = (SELECT MAX(s2.alert_id) FROM sos_alerts s2 WHERE s2.ride_id = r.ride_id "
                + "AND s2.status NOT IN ('RESOLVED', 'CLOSED') AND s2.created_at >= DATE_SUB(NOW(), INTERVAL 3 HOUR)) "
                + "WHERE r.status IN ('PENDING', 'ACCEPTED', 'ENROUTE', 'ARRIVED', 'STARTED') "
                + "AND r.updated_at >= DATE_SUB(NOW(), INTERVAL 2 HOUR) ORDER BY r.created_at DESC";
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : jdbcTemplate.queryForList(sql)) {
            Map<String, Object> ride = new LinkedHashMap<>();
            ride.put("id", row.get("ride_id"));
            ride.put("status", row.get("status"));
            ride.put("pickupLocation", row.get("pickup_location"));
            ride.put("destination", row.get("destination"));
            ride.put("pickupLat", row.get("pickup_lat"));
            ride.put("pickupLng", row.get("pickup_lng"));
            ride.put("destLat", row.get("dest_lat"));
            ride.put("destLng", row.get("dest_lng"));
            ride.put("currentLat", row.get("current_lat"));
            ride.put("currentLng", row.get("current_lng"));
            ride.put("createdAt", row.get("created_at"));
            ride.put("riderName", row.get("rider_name"));
            ride.put("riderPhone", row.get("rider_phone"));
            ride.put("driverName", row.get("driver_name"));
            ride.put("driverPhone", row.get("driver_phone"));
            ride.put("sos", row.get("alert_id") == null ? null : Map.of("id", row.get("alert_id"), "status", row.get("sos_status"), "gpsLat", row.get("sos_lat"), "gpsLng", row.get("sos_lng")));
            result.add(ride);
        }
        return result;
    }

    // Feature: Retrieve alerts matching the active-alert condition.
    // Where: SecurityController.activeSosRows() below.
    // How: activeSosRows() calls sosRows() in this class to carry out the operation. Any failed
    // checks stop the operation with the exception shown below.
    private List<Map<String, Object>> activeSosRows() {
        return sosRows("s.status NOT IN ('RESOLVED', 'CLOSED') "
            + "AND s.created_at >= DATE_SUB(NOW(), INTERVAL 3 HOUR)");
    }

    // Feature: Retrieve alerts matching the resolved-alert condition.
    // Where: SecurityController.resolvedSosRows() below.
    // How: resolvedSosRows() calls sosRows() in this class to carry out the operation. Any failed
    // checks stop the operation with the exception shown below.
    private List<Map<String, Object>> resolvedSosRows() {
        return sosRows("s.status IN ('RESOLVED', 'CLOSED')");
    }

    // Feature: Join alerts to their ride and reporter details using the supplied status condition.
    // Where: SecurityController.sosRows() below.
    // How: sosRows() uses jdbcTemplate.queryForList() to read, validate or save the data for this
    // operation. The return/exception handling below supplies its result to the caller.
    private List<Map<String, Object>> sosRows(String condition) {
        String sql = "SELECT s.alert_id, s.status, s.gps_lat, s.gps_lng, s.created_at, s.audio_file_path, s.recording_duration, "
                + "s.triggered_by, reporter.full_name AS triggered_by_name, reporter.role AS triggered_by_role, "
                + "r.ride_id, r.pickup_location, r.destination, rider.full_name AS rider_name, driver.full_name AS driver_name "
                + "FROM sos_alerts s JOIN rides r ON r.ride_id = s.ride_id LEFT JOIN users rider ON rider.user_id = r.rider_id "
                + "LEFT JOIN users driver ON driver.user_id = r.driver_id "
                + "LEFT JOIN users reporter ON reporter.user_id = s.triggered_by "
                + "WHERE " + condition + " ORDER BY s.created_at DESC";
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : jdbcTemplate.queryForList(sql)) {
            Map<String, Object> alert = new LinkedHashMap<>();
            alert.put("id", row.get("alert_id"));
            alert.put("reference", String.format("SOS-%04d", ((Number) row.get("alert_id")).longValue()));
            alert.put("status", row.get("status"));
            alert.put("gpsLat", row.get("gps_lat"));
            alert.put("gpsLng", row.get("gps_lng"));
            alert.put("createdAt", row.get("created_at"));
            alert.put("rideId", row.get("ride_id"));
            alert.put("rideReference", String.format("R-%d", ((Number) row.get("ride_id")).longValue()));
            alert.put("riderName", row.get("rider_name"));
            alert.put("driverName", row.get("driver_name"));
            alert.put("triggeredBy", row.get("triggered_by"));
            alert.put("triggeredByName", row.get("triggered_by_name"));
            alert.put("triggeredByRole", row.get("triggered_by_role"));
            alert.put("pickupLocation", row.get("pickup_location"));
            alert.put("destination", row.get("destination"));
            alert.put("hasAudio", row.get("audio_file_path") != null);
            alert.put("recordingDuration", row.get("recording_duration"));
            result.add(alert);
        }
        return result;
    }
}
