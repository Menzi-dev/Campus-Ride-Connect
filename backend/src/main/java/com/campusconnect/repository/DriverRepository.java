package com.campusconnect.repository;

import com.campusconnect.entity.Driver;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DriverRepository extends JpaRepository<Driver, Long> {
    long countByApprovalStatus(Driver.ApprovalStatus approvalStatus);
    List<Driver> findByApprovalStatus(Driver.ApprovalStatus approvalStatus);
    Optional<Driver> findByUserId(Long userId);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select d from Driver d where d.id = :id")
    Optional<Driver> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);
}
