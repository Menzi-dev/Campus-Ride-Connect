// Database access: provide saved SosAlert lookups and updates for the services/controllers. Spring
// implements the named query methods; any written query defines a specific lookup.
// Where: SosAlertRepository in this file; queries operate on the SosAlert entity in
// ../entity/SosAlert.java.
// How: JpaRepository supplies save/find/delete operations. Spring builds queries from names such as
// findByRideIdOrderByCreatedAtDesc(); @Query adds explicit queries where present.
package com.campusconnect.repository;

import com.campusconnect.entity.SosAlert;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/** Provides Spring Data persistence queries for safety alerts. */
public interface SosAlertRepository extends JpaRepository<SosAlert, Long> {
    List<SosAlert> findByRideIdOrderByCreatedAtDesc(Long rideId);
}
