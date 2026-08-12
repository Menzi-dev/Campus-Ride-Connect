package com.campusconnect.repository;

import com.campusconnect.entity.Ride;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface RideRepository extends JpaRepository<Ride, Long> {
    List<Ride> findByRiderIdOrderByCreatedAtDesc(Long riderId);
    int countByCreatedAtAfter(LocalDateTime after);
    List<Ride> findByStatusOrderByCreatedAtDesc(Ride.RideStatus status);
    List<Ride> findByDriverIdAndStatusIn(Long driverId, List<Ride.RideStatus> statuses);
    Optional<Ride> findByRiderIdAndStatusIn(Long riderId, List<Ride.RideStatus> statuses);
}