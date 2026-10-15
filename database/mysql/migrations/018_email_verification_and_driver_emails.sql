-- Database migration: email verification and driver emails. Apply these schema/data changes to the
-- intended database after checking its current structure.
-- Non-destructive migration for deployments that do not use Hibernate ddl-auto=update.
-- Apply ONCE. Do not run manually if Hibernate has already created these fields/tables.
-- Existing accounts remain NULL (legacy access). New AuthService registrations explicitly write FALSE.
-- Where: SQL statements in database/mysql/migrations/018_email_verification_and_driver_emails.sql,
-- involving users, email_verification_tokens and driver_decision_emails.
-- How: MySQL executes these statements directly. CREATE/ALTER change structure;
-- INSERT/UPDATE/DELETE change rows when present. Java entities/repositories use the resulting
-- application tables.
ALTER TABLE users ADD COLUMN email_verified BOOLEAN NULL DEFAULT NULL;
CREATE TABLE email_verification_tokens (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    used_at DATETIME(6) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE driver_decision_emails (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    recipient VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    decision VARCHAR(255) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    next_attempt_at DATETIME(6) NOT NULL,
    sent_at DATETIME(6) NULL,
    INDEX pending_delivery (sent_at, next_attempt_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
