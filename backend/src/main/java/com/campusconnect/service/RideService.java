package com.campusconnect.service;

import com.campusconnect.dto.RideRequest;
import com.campusconnect.entity.Ride;
import com.campusconnect.repository.RideRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class RideService {

    @Autowired
    private RideRepository rideRepository;

    @Autowired
    private RideFaceVerificationService faceVerification;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    /**
     * Create a new ride request from the rider
     */
    @org.springframework.transaction.annotation.Transactional
    public Ride requestRide(Long riderId, RideRequest request) {
        String requestKey = request.getClientRequestId() == null ? request.getFaceVerificationToken() : request.getClientRequestId();
        if (requestKey != null) {
            if (requestKey.length() > 100) throw new IllegalArgumentException("Invalid request identifier");
            var existing = rideRepository.findByFaceVerificationKey(requestKey);
            if (existing.isPresent()) {
                Ride previous = existing.get();
                if (!riderId.equals(previous.getRiderId()) || !faceVerification.fingerprint(request).equals(previous.getFaceRequestFingerprint()))
                    throw new IllegalArgumentException("Face confirmation does not belong to these ride details.");
                return previous; // Retrying after a lost response never creates another ride/payment.
            }
        }
        String payment = request.getPaymentMethod() == null ? "" : request.getPaymentMethod().trim().toUpperCase();
        if (!payment.equals("CASH") && !payment.equals("CARD"))
            throw new IllegalArgumentException("Choose cash or card before face verification.");
        if (payment.equals("CARD") && (request.getCardLastFour() == null || !request.getCardLastFour().matches("[0-9]{4}")))
            throw new IllegalArgumentException("Choose a saved card before face verification.");
        if (request.getPickupLat() == null || request.getPickupLng() == null || request.getDestLat() == null || request.getDestLng() == null)
            throw new IllegalArgumentException("Pickup and destination coordinates are required.");
        if (request.getScheduledAt() != null && !request.getScheduledAt().isAfter(LocalDateTime.now()))
            throw new IllegalArgumentException("Choose a future time for your scheduled ride.");
        var receipt = faceVerification.consume(riderId, request);
        Ride ride = new Ride();
        ride.setFaceMatchedAt(LocalDateTime.ofInstant(receipt.matchedAt(), java.time.ZoneOffset.UTC));
        ride.setFaceMatchMethod("opencv-sface-v1");
        ride.setFaceVerificationKey(requestKey);
        ride.setFaceRequestFingerprint(faceVerification.fingerprint(request));
        ride.setRiderId(riderId);
        ride.setPickupLocation(request.getPickupLocation() != null ? request.getPickupLocation() : request.getPickupAddress());
        ride.setDestination(request.getDestination() != null ? request.getDestination() : request.getDestinationAddress());
        ride.setPickupLat(request.getPickupLat());
        ride.setPickupLng(request.getPickupLng());
        ride.setDestLat(request.getDestLat());
        ride.setDestLng(request.getDestLng());
        ride.setDistanceKm(request.getDistanceKm());
        ride.setDurationMinutes(request.getDuration());
        ride.setFare(request.getFare());
        ride.setScheduledAt(request.getScheduledAt());

        String requestedStatus = request.getStatus() == null ? "" : request.getStatus().trim();
        boolean isScheduled = "scheduled".equalsIgnoreCase(requestedStatus)
                || (request.getScheduledAt() != null && !"pending".equalsIgnoreCase(requestedStatus));
        ride.setStatus(isScheduled ? Ride.RideStatus.SCHEDULED : Ride.RideStatus.PENDING);
        ride.setCreatedAt(LocalDateTime.now());

        Ride saved = rideRepository.saveAndFlush(ride);
        jdbcTemplate.update("INSERT INTO payments (ride_id, payer_id, amount, method, status, transaction_ref) VALUES (?, ?, ?, ?, 'PENDING', ?)",
            saved.getId(), riderId, saved.getFare(), payment, payment.equals("CARD") ? "CARD-" + request.getCardLastFour() : null);
        return saved;
    }

    /**
     * Get all ride history for a rider
     */
    public List<Ride> getHistory(Long riderId) {
        return rideRepository.findByRiderIdOrderByCreatedAtDesc(riderId);
    }

    public List<Ride> getScheduledRidesForRider(Long riderId) {
        return rideRepository.findByRiderIdAndStatusInOrderByCreatedAtDesc(riderId,
                List.of(Ride.RideStatus.SCHEDULED, Ride.RideStatus.PENDING, Ride.RideStatus.ACCEPTED,
                        Ride.RideStatus.ENROUTE, Ride.RideStatus.ARRIVED, Ride.RideStatus.STARTED,
                        Ride.RideStatus.COMPLETED));
    }

    /**
     * Get all pending rides (not assigned to any driver)
     */
    public List<Ride> getPendingRides() {
        return rideRepository.findByStatusOrderByCreatedAtDesc(Ride.RideStatus.PENDING);
    }

    /**
     * Get a specific ride by ID
     */
    public Optional<Ride> getRideById(Long rideId) {
        return rideRepository.findById(rideId);
    }

    public Ride saveRide(Ride ride) {
        return rideRepository.save(ride);
    }

    /**
     * Get active ride for a rider (not completed or cancelled)
     */
    public Optional<Ride> getActiveRideForRider(Long riderId) {
        return rideRepository.findFirstByRiderIdAndStatusInOrderByCreatedAtDesc(riderId,
            List.of(Ride.RideStatus.PENDING, Ride.RideStatus.ACCEPTED, 
                    Ride.RideStatus.ENROUTE, Ride.RideStatus.ARRIVED, 
                    Ride.RideStatus.STARTED));
    }

    /**
     * Accept a ride as a driver
     */
    public Ride acceptRide(Long rideId, Long driverId) {
        Optional<Ride> rideOpt = rideRepository.findById(rideId);
        if (rideOpt.isPresent()) {
            Ride ride = rideOpt.get();
            ride.setDriverId(driverId);
            ride.setStatus(Ride.RideStatus.ACCEPTED);
            return rideRepository.save(ride);
        }
        throw new RuntimeException("Ride not found");
    }

    /**
     * Update ride status
     */
    public Ride updateRideStatus(Long rideId, Ride.RideStatus status) {
        Optional<Ride> rideOpt = rideRepository.findById(rideId);
        if (rideOpt.isPresent()) {
            Ride ride = rideOpt.get();
            ride.setStatus(status);
            if (status == Ride.RideStatus.STARTED && ride.getStartedAt() == null) {
                ride.setStartedAt(LocalDateTime.now());
            }
            if (status == Ride.RideStatus.COMPLETED && ride.getCompletedAt() == null) {
                ride.setCompletedAt(LocalDateTime.now());
            }
            return rideRepository.save(ride);
        }
        throw new RuntimeException("Ride not found");
    }

    /**
     * Cancel a ride
     */
    public Ride cancelRide(Long rideId) {
        return updateRideStatus(rideId, Ride.RideStatus.CANCELLED);
    }
}
