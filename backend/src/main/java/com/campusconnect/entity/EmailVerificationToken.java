// Database record: store email confirmation hash, account reference and expiry/use state. The
// annotations map these fields to table columns; the methods below read and update the record.
// Where: EmailVerificationToken in this file maps to the email_verification_tokens table.
// How: @Id identifies its record and @Column/@Enumerated define field storage. Repository/service
// code reads and updates these fields through the methods below.
package com.campusconnect.entity;

import jakarta.persistence.*;
import java.time.Instant;

/** Stores hashed account verification tokens and codes together with expiry, attempts and use state. */
@Entity
@Table(name = "email_verification_tokens")
public class EmailVerificationToken {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "user_id", nullable = false, unique = true) private Long userId;
    @Column(name = "token_hash", nullable = false, unique = true, length = 64) private String tokenHash;
    @Column(nullable = false) private String email;
    @Column(name = "expires_at", nullable = false) private Instant expiresAt;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "used_at") private Instant usedAt;
    @Column(name = "code_hash", length = 255) private String codeHash;
    @Column(name = "code_expires_at") private Instant codeExpiresAt;
    @Column(name = "code_attempts") private Integer codeAttempts = 0;
    public String getCodeHash() { return codeHash; }
    public void setCodeHash(String value) { codeHash = value; }
    public Instant getCodeExpiresAt() { return codeExpiresAt; }
    public void setCodeExpiresAt(Instant value) { codeExpiresAt = value; }
    public int getCodeAttempts() { return codeAttempts == null ? 0 : codeAttempts; }
    public void setCodeAttempts(int value) { codeAttempts = value; }
    public Long getUserId() { return userId; }
    public void setUserId(Long value) { userId = value; }
    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String value) { tokenHash = value; }
    public String getEmail() { return email; }
    public void setEmail(String value) { email = value; }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant value) { expiresAt = value; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant value) { createdAt = value; }
    public Instant getUsedAt() { return usedAt; }
    public void setUsedAt(Instant value) { usedAt = value; }
}
