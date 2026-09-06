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

    /**
     * Create a new ride request from the rider
     */
    public Ride requestRide(Long riderId, RideRequest request) {
        Ride ride = new Ride();
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
        ride.setStatus(Ride.RideStatus.PENDING);
        ride.setCreatedAt(LocalDateTime.now());

        return rideRepository.save(ride);
    }

    /**
     * Get all ride history for a rider
     */
    public List<Ride> getHistory(Long riderId) {
        return rideRepository.findByRiderIdOrderByCreatedAtDesc(riderId);
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

    /**
     * Get active ride for a rider (not completed or cancelled)
     */
    public Optional<Ride> getActiveRideForRider(Long riderId) {
        return rideRepository.findByRiderIdAndStatusIn(riderId, 
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