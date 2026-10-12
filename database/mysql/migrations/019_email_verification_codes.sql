-- Apply once only when Hibernate ddl-auto=update has not already added these fields.
-- Existing verification links remain valid. Existing accounts need a resend to receive a code.
ALTER TABLE email_verification_tokens
    ADD COLUMN code_hash VARCHAR(255) NULL,
    ADD COLUMN code_expires_at DATETIME(6) NULL,
    ADD COLUMN code_attempts INT NULL DEFAULT 0;
