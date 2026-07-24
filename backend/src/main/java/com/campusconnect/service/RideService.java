package com.campusconnect.service;

import com.campusconnect.dto.RideRequest;
import com.campusconnect.entity.Ride;
import com.campusconnect.repository.RideRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class RideService {

    @Autowired
    private RideRepository rideRepository;

    public Ride requestRide(Long riderId, RideRequest request) {
        Ride ride = new Ride();
        ride.setRiderId(riderId);
        ride.setPickupLocation(request.getPickupLocation());
        ride.setPickupLat(request.getPickupLat());
        ride.setPickupLng(request.getPickupLng());
        ride.setDestination(request.getDestination());
        ride.setDestLat(request.getDestLat());
        ride.setDestLng(request.getDestLng());
        ride.setDistanceKm(request.getDistanceKm());
        ride.setFare(request.getFare());
        ride.setStatus(Ride.RideStatus.PENDING);
        ride.setCreatedAt(LocalDateTime.now());

        return rideRepository.save(ride);
    }

    public List<Ride> getHistory(Long riderId) {
        return rideRepository.findByRiderIdOrderByCreatedAtDesc(riderId);
    }
}