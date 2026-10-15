// Database record: store ride alert, reporter, location, audio evidence and response information.
// The annotations map these fields to table columns; the methods below read and update the record.
// Where: SosAlert in this file maps to the sos_alerts table.
// How: @Id identifies its record and @Column/@Enumerated define field storage. Repository/service
// code reads and updates these fields through the methods below.
package com.campusconnect.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** Maps a ride safety alert, location, response state and available evidence metadata. */
@Entity
@Table(name = "sos_alerts")
public class SosAlert {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "alert_id")
    private Long id;

    @Column(name = "ride_id", nullable = false)
    private Long rideId;

    @Column(name = "triggered_by", nullable = false)
    private Long triggeredBy;

    @Column(name = "gps_lat")
    private Double gpsLat;

    @Column(name = "gps_lng")
    private Double gpsLng;

    @Column(name = "audio_file_path", length = 500)
    private String audioFilePath;

    @Column(name = "recording_duration")
    private Integer recordingDuration;

    @Column(name = "status", nullable = false, length = 30)
    private String status = "DISPATCHED";

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }
    public Long getRideId() { return rideId; }
    public void setRideId(Long rideId) { this.rideId = rideId; }
    public Long getTriggeredBy() { return triggeredBy; }
    public void setTriggeredBy(Long triggeredBy) { this.triggeredBy = triggeredBy; }
    public Double getGpsLat() { return gpsLat; }
    public void setGpsLat(Double gpsLat) { this.gpsLat = gpsLat; }
    public Double getGpsLng() { return gpsLng; }
    public void setGpsLng(Double gpsLng) { this.gpsLng = gpsLng; }
    public String getAudioFilePath() { return audioFilePath; }
    public void setAudioFilePath(String audioFilePath) { this.audioFilePath = audioFilePath; }
    public Integer getRecordingDuration() { return recordingDuration; }
    public void setRecordingDuration(Integer recordingDuration) { this.recordingDuration = recordingDuration; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
