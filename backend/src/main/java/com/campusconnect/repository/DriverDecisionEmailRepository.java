package com.campusconnect.repository;
import com.campusconnect.entity.DriverDecisionEmail;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
public interface DriverDecisionEmailRepository extends JpaRepository<DriverDecisionEmail, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<DriverDecisionEmail> findTop10BySentAtIsNullAndNextAttemptAtLessThanEqualOrderByIdAsc(Instant now);
}
