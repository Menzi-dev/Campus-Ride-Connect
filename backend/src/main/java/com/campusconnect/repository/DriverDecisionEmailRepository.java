// Database access: provide saved DriverDecisionEmail lookups and updates for the
// services/controllers. Spring implements the named query methods; any written query defines a
// specific lookup.
// Where: DriverDecisionEmailRepository in this file; queries operate on the DriverDecisionEmail
// entity in ../entity/DriverDecisionEmail.java.
// How: JpaRepository supplies save/find/delete operations. Spring builds queries from names such as
// findTop10BySentAtIsNullAndNextAttemptAtLessThanEqualOrderByIdAsc(); @Query adds explicit queries
// where present.
package com.campusconnect.repository;
import com.campusconnect.entity.DriverDecisionEmail;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
/** Provides Spring Data persistence queries for queued driver decision emails. */
public interface DriverDecisionEmailRepository extends JpaRepository<DriverDecisionEmail, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<DriverDecisionEmail> findTop10BySentAtIsNullAndNextAttemptAtLessThanEqualOrderByIdAsc(Instant now);
}
