// Database record: store journey details, rider/driver references, status, timing, face-check
// records and ratings. The annotations map these fields to table columns; the methods below read
// and update the record.
// Where: Ride in this file maps to the rides table.
// How: @Id identifies its record and @Column/@Enumerated define field storage. Repository/service
// code reads and updates these fields through the methods below.
package com.campusconnect.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Maps journey details, assignment, status, verification and rider feedback to a persisted ride. */
@Entity
@Table(name = "rides")
public class Ride {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ride_id")
    private Long id;

    // Feature: Link the ride to its rider and eventual driver. The driver stays empty
    // while the request is waiting for acceptance.
    // Where: riderId and driverId fields below, mapped to rides.rider_id/driver_id.
    // How: RideService sets the rider during booking; DriverRideAcceptanceService.accept()
    // sets the driver after approval, face confirmation and availability checks.
    @Column(name = "rider_id", nullable = false)
    private Long riderId;

    @Column(name = "driver_id")
    private Long driverId; // nullable until a driver accepts

    // Feature: Store journey locations and coordinates, including the latest saved
    // trip position used by monitoring screens.
    // Where: pickupLocation through currentLng in the fields below.
    // How: RideService copies the booking coordinates; DriverController's location
    // endpoint updates the current position used by client monitoring requests.
    @Column(name = "pickup_location")
    private String pickupLocation;

    @Column(name = "destination")
    private String destination;

    @Column(name = "pickup_lat")
    private Double pickupLat;

    @Column(name = "pickup_lng")
    private Double pickupLng;

    @Column(name = "dest_lat")
    private Double destLat;

    @Column(name = "dest_lng")
    private Double destLng;

    @Column(name = "current_lat")
    private Double currentLat;

    @Column(name = "current_lng")
    private Double currentLng;

    // Feature: Keep the fare, distance and estimated duration with the ride record.
    // Where: fare, distanceKm and durationMinutes map to the rides table columns below.
    // How: RideService.requestRide() copies these values from RideRequest before saving.
    @Column(name = "fare")
    private BigDecimal fare;

    @Column(name = "distance_km")
    private Double distanceKm;

    @Column(name = "duration_min")
    private Double durationMinutes;

    // Feature: Track the journey stage and booking/start/completion times so the
    // client and backend can follow the same trip progress.
    // Where: status, scheduledAt, startedAt and completedAt fields below.
    // How: @Enumerated stores the RideStatus name; booking, dispatch and trip-action
    // code update these fields, and the client retrieves them through ride endpoints.
    @Enumerated(EnumType.STRING)
    @Column(name = "status")
    private RideStatus status;

    @Column(name = "scheduled_at")
    private LocalDateTime scheduledAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    // Feature: Keep cancellation details and both participants' feedback with the trip.
    // Where: cancellationReason/cancelledBy and rider/driver rating fields below.
    // How: RideController cancellation and rating methods set these values before saving.
    @Column(name = "cancellation_reason", length = 500)
    private String cancellationReason;

    @Column(name = "cancelled_by")
    private Long cancelledBy;

    @Column(name = "rider_rating")
    private Integer riderRating;

    @Column(name = "rider_rating_comment", length = 500)
    private String riderRatingComment;

    @Column(name = "driver_rating")
    private Integer driverRating;

    @Column(name = "driver_rating_comment", length = 500)
    private String driverRatingComment;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    // Feature: Record successful rider/driver comparisons and the request details
    // used to recognise an exact booking retry. Internal retry fields are hidden from JSON.
    // Where: faceMatchedAt, driverFaceMatchedAt, faceVerificationKey and related fields below.
    // How: booking/acceptance services set match times after consume() validates a token;
    // RideService checks the request key/details on retries. @JsonIgnore hides internal fields.
    @Column(name = "face_matched_at")
    private LocalDateTime faceMatchedAt;
    @Column(name = "driver_face_matched_at")
    private LocalDateTime driverFaceMatchedAt;
    public LocalDateTime getDriverFaceMatchedAt() { return driverFaceMatchedAt; }
    public void setDriverFaceMatchedAt(LocalDateTime value) { driverFaceMatchedAt = value; }
    @Column(name = "face_match_method")
    private String faceMatchMethod;
    @com.fasterxml.jackson.annotation.JsonIgnore
    @Column(name = "face_verification_key", unique = true)
    private String faceVerificationKey;
    @com.fasterxml.jackson.annotation.JsonIgnore
    @Column(name = "face_request_fingerprint", columnDefinition = "TEXT")
    private String faceRequestFingerprint;
    public String getFaceVerificationKey() { return faceVerificationKey; }
    public void setFaceVerificationKey(String value) { faceVerificationKey = value; }
    public String getFaceRequestFingerprint() { return faceRequestFingerprint; }
    public void setFaceRequestFingerprint(String value) { faceRequestFingerprint = value; }
    public LocalDateTime getFaceMatchedAt() { return faceMatchedAt; }
    public void setFaceMatchedAt(LocalDateTime value) { faceMatchedAt = value; }
    public String getFaceMatchMethod() { return faceMatchMethod; }
    public void setFaceMatchMethod(String value) { faceMatchMethod = value; }

    public enum RideStatus {
        SCHEDULED, PENDING, ACCEPTED, ENROUTE, ARRIVED, STARTED, COMPLETED, CANCELLED
    }

    // Getters and setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    
    // Alias for getId() for consistency with other entities
    public Long getRideId() { return id; }
    public void setRideId(Long id) { this.id = id; }

    public Long getRiderId() { return riderId; }
    public void setRiderId(Long riderId) { this.riderId = riderId; }

    public Long getDriverId() { return driverId; }
    public void setDriverId(Long driverId) { this.driverId = driverId; }

    public String getPickupLocation() { return pickupLocation; }
    public void setPickupLocation(String pickupLocation) { this.pickupLocation = pickupLocation; }

    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }

    public Double getPickupLat() { return pickupLat; }
    public void setPickupLat(Double pickupLat) { this.pickupLat = pickupLat; }

    public Double getPickupLng() { return pickupLng; }
    public void setPickupLng(Double pickupLng) { this.pickupLng = pickupLng; }

    public Double getDestLat() { return destLat; }
    public void setDestLat(Double destLat) { this.destLat = destLat; }

    public Double getDestLng() { return destLng; }
    public void setDestLng(Double destLng) { this.destLng = destLng; }

    public Double getCurrentLat() { return currentLat; }
    public void setCurrentLat(Double currentLat) { this.currentLat = currentLat; }

    public Double getCurrentLng() { return currentLng; }
    public void setCurrentLng(Double currentLng) { this.currentLng = currentLng; }

    public BigDecimal getFare() { return fare; }
    public void setFare(BigDecimal fare) { this.fare = fare; }

    public Double getDistanceKm() { return distanceKm; }
    public void setDistanceKm(Double distanceKm) { this.distanceKm = distanceKm; }

    public Double getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(Double durationMinutes) { this.durationMinutes = durationMinutes; }

    public RideStatus getStatus() { return status; }
    public void setStatus(RideStatus status) { this.status = status; }

    public LocalDateTime getScheduledAt() { return scheduledAt; }
    public void setScheduledAt(LocalDateTime scheduledAt) { this.scheduledAt = scheduledAt; }

    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }

    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }

    public String getCancellationReason() { return cancellationReason; }
    public void setCancellationReason(String cancellationReason) { this.cancellationReason = cancellationReason; }

    public Long getCancelledBy() { return cancelledBy; }
    public void setCancelledBy(Long cancelledBy) { this.cancelledBy = cancelledBy; }

    public Integer getRiderRating() { return riderRating; }
    public void setRiderRating(Integer riderRating) { this.riderRating = riderRating; }

    public String getRiderRatingComment() { return riderRatingComment; }
    public void setRiderRatingComment(String riderRatingComment) { this.riderRatingComment = riderRatingComment; }

    public Integer getDriverRating() { return driverRating; }
    public void setDriverRating(Integer driverRating) { this.driverRating = driverRating; }

    public String getDriverRatingComment() { return driverRatingComment; }
    public void setDriverRatingComment(String driverRatingComment) { this.driverRatingComment = driverRatingComment; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
