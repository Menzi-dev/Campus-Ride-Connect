-- Database migration: email verification codes. Apply these schema/data changes to the intended
-- database after checking its current structure.
-- Apply once only when Hibernate ddl-auto=update has not already added these fields.
-- Existing verification links remain valid. Existing accounts need a resend to receive a code.
-- Where: SQL statements in database/mysql/migrations/019_email_verification_codes.sql, involving
-- email_verification_tokens.
-- How: MySQL executes these statements directly. CREATE/ALTER change structure;
-- INSERT/UPDATE/DELETE change rows when present. Java entities/repositories use the resulting
-- application tables.
ALTER TABLE email_verification_tokens
    ADD COLUMN code_hash VARCHAR(255) NULL,
    ADD COLUMN code_expires_at DATETIME(6) NULL,
    ADD COLUMN code_attempts INT NULL DEFAULT 0;
