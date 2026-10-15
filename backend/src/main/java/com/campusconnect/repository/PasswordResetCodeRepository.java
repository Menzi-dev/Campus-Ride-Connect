// Database access: provide saved PasswordResetCode lookups and updates for the
// services/controllers. Spring implements the named query methods; any written query defines a
// specific lookup.
// Where: PasswordResetCodeRepository in this file; queries operate on the PasswordResetCode entity
// in ../entity/PasswordResetCode.java.
// How: JpaRepository supplies save/find/delete operations. Spring builds queries from names such as
// findByEmail() and deleteByEmail(); @Query adds explicit queries where present.
package com.campusconnect.repository;

import com.campusconnect.entity.PasswordResetCode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/** Provides Spring Data persistence queries for password reset codes. */
public interface PasswordResetCodeRepository extends JpaRepository<PasswordResetCode, Long> {
    Optional<PasswordResetCode> findByEmail(String email);
    void deleteByEmail(String email);
}