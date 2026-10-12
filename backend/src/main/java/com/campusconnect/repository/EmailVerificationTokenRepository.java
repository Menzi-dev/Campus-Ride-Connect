package com.campusconnect.repository;

import com.campusconnect.entity.EmailVerificationToken;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.Optional;

public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, Long> {
    Optional<EmailVerificationToken> findByUserId(Long userId);
    // Read the user ID first, then lock the user before its token (same lock order as resend).
    @Query("select t.email from EmailVerificationToken t where t.tokenHash = :tokenHash")
    Optional<String> findEmailByTokenHash(@Param("tokenHash") String tokenHash);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from EmailVerificationToken t where t.userId = :userId")
    Optional<EmailVerificationToken> findByUserIdForUpdate(@Param("userId") Long userId);
}
