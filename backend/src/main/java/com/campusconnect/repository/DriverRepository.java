// Database access: provide saved Driver lookups and updates for the services/controllers. Spring
// implements the named query methods; any written query defines a specific lookup.
// Where: DriverRepository in this file; queries operate on the Driver entity in
// ../entity/Driver.java.
// How: JpaRepository supplies save/find/delete operations. Spring builds queries from names such as
// countByApprovalStatus() and findByApprovalStatus(); @Query adds explicit queries where present.
package com.campusconnect.repository;

import com.campusconnect.entity.Driver;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/** Provides Spring Data persistence queries for driver profiles. */
public interface DriverRepository extends JpaRepository<Driver, Long> {
    long countByApprovalStatus(Driver.ApprovalStatus approvalStatus);
    List<Driver> findByApprovalStatus(Driver.ApprovalStatus approvalStatus);
    Optional<Driver> findByUserId(Long userId);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select d from Driver d where d.id = :id")
    Optional<Driver> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);
}
