// Database access: provide saved EmailVerificationToken lookups and updates for the
// services/controllers. Spring implements the named query methods; any written query defines a
// specific lookup.
// Where: EmailVerificationTokenRepository in this file; queries operate on the
// EmailVerificationToken entity in ../entity/EmailVerificationToken.java.
// How: JpaRepository supplies save/find/delete operations. Spring builds queries from names such as
// findByUserId() and findEmailByTokenHash(); @Query adds explicit queries where present.
package com.campusconnect.repository;

import com.campusconnect.entity.EmailVerificationToken;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.Optional;

/** Provides Spring Data persistence queries for account verification tokens and codes. */
public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, Long> {
    Optional<EmailVerificationToken> findByUserId(Long userId);
    // Read the user ID first, then lock the user before its token (same lock order as resend).
    @Query("select t.email from EmailVerificationToken t where t.tokenHash = :tokenHash")
    Optional<String> findEmailByTokenHash(@Param("tokenHash") String tokenHash);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from EmailVerificationToken t where t.userId = :userId")
    Optional<EmailVerificationToken> findByUserIdForUpdate(@Param("userId") Long userId);
}
