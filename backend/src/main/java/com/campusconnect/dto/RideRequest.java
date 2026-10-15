// Booking data: carry journey, schedule, fare, payment and face-confirmation details, including the
// stable identifier used for request retries.
// Where: RideRequest fields and getters/setters in this file.
// How: Spring/Jackson reads or writes JSON using these properties. Controllers pass request objects
// into services or return the response object to the client.
package com.campusconnect.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Carries journey, payment, scheduling and face-confirmation fields for booking and acceptance validation. */
public class RideRequest {
    private String pickupLocation;
    private String pickupAddress;
    private Double pickupLat;
    private Double pickupLng;
    private String destination;
    private String destinationAddress;
    private Double destLat;
    private Double destLng;
    private Double distanceKm;
    private Double duration;
    private BigDecimal fare;
    private String status;
    private LocalDateTime scheduledAt;
    private String faceVerificationToken;
    private String clientRequestId;
    public String getClientRequestId() { return clientRequestId; }
    public void setClientRequestId(String value) { clientRequestId = value; }
    private String paymentMethod;
    private String cardLastFour;
    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String value) { paymentMethod = value; }
    public String getCardLastFour() { return cardLastFour; }
    public void setCardLastFour(String value) { cardLastFour = value; }
    public String getFaceVerificationToken() { return faceVerificationToken; }
    public void setFaceVerificationToken(String value) { faceVerificationToken = value; }

    // Getters and Setters
    public String getPickupLocation() { return pickupLocation; }
    public void setPickupLocation(String pickupLocation) { this.pickupLocation = pickupLocation; }

    public String getPickupAddress() { return pickupAddress; }
    public void setPickupAddress(String pickupAddress) { this.pickupAddress = pickupAddress; }

    public Double getPickupLat() { return pickupLat; }
    public void setPickupLat(Double pickupLat) { this.pickupLat = pickupLat; }

    public Double getPickupLng() { return pickupLng; }
    public void setPickupLng(Double pickupLng) { this.pickupLng = pickupLng; }

    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }

    public String getDestinationAddress() { return destinationAddress; }
    public void setDestinationAddress(String destinationAddress) { this.destinationAddress = destinationAddress; }

    public Double getDestLat() { return destLat; }
    public void setDestLat(Double destLat) { this.destLat = destLat; }

    public Double getDestLng() { return destLng; }
    public void setDestLng(Double destLng) { this.destLng = destLng; }

    public Double getDistanceKm() { return distanceKm; }
    public void setDistanceKm(Double distanceKm) { this.distanceKm = distanceKm; }

    public Double getDuration() { return duration; }
    public void setDuration(Double duration) { this.duration = duration; }

    public BigDecimal getFare() { return fare; }
    public void setFare(BigDecimal fare) { this.fare = fare; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getScheduledAt() { return scheduledAt; }
    public void setScheduledAt(LocalDateTime scheduledAt) { this.scheduledAt = scheduledAt; }
}
