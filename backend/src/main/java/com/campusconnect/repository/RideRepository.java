// Database access: provide saved Ride lookups and updates for the services/controllers. Spring
// implements the named query methods; any written query defines a specific lookup.
// Where: RideRepository in this file; queries operate on the Ride entity in ../entity/Ride.java.
// How: JpaRepository supplies save/find/delete operations. Spring builds queries from names such as
// findLockedById() and findByFaceVerificationKey(); @Query adds explicit queries where present.
package com.campusconnect.repository;

import com.campusconnect.entity.Ride;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/** Provides Spring Data persistence queries for ride records. */
public interface RideRepository extends JpaRepository<Ride, Long> {
    /** Holds a write lock until the acceptance transaction ends. */
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
