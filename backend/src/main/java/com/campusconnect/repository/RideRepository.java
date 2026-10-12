package com.campusconnect.repository;

import com.campusconnect.entity.Ride;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface RideRepository extends JpaRepository<Ride, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select r from Ride r where r.id = :id")
    Optional<Ride> findLockedById(@org.springframework.data.repository.query.Param("id") Long id);
    Optional<Ride> findByFaceVerificationKey(String key);
    List<Ride> findByRiderIdOrderByCreatedAtDesc(Long riderId);
    int countByCreatedAtAfter(LocalDateTime after);
    List<Ride> findByStatusOrderByCreatedAtDesc(Ride.RideStatus status);
    List<Ride> findByDriverIdAndStatusIn(Long driverId, List<Ride.RideStatus> statuses);
    List<Ride> findByDriverIdAndStatus(Long driverId, Ride.RideStatus status);
    List<Ride> findByRiderIdAndStatusInOrderByCreatedAtDesc(Long riderId, List<Ride.RideStatus> statuses);
    Optional<Ride> findFirstByRiderIdAndStatusInOrderByCreatedAtDesc(Long riderId, List<Ride.RideStatus> statuses);
}
