package com.campusconnect.repository;

import com.campusconnect.entity.Driver;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DriverRepository extends JpaRepository<Driver, Long> {
    long countByApprovalStatus(Driver.ApprovalStatus approvalStatus);
    List<Driver> findByApprovalStatus(Driver.ApprovalStatus approvalStatus);
    Optional<Driver> findByUserId(Long userId);
}