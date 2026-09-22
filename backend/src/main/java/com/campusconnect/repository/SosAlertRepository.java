package com.campusconnect.repository;

import com.campusconnect.entity.SosAlert;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SosAlertRepository extends JpaRepository<SosAlert, Long> {
    List<SosAlert> findByRideIdOrderByCreatedAtDesc(Long rideId);
}
