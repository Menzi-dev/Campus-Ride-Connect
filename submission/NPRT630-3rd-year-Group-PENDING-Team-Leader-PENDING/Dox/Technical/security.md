# Security review for documentation

Implemented mechanisms: BCrypt password hashing; JWT filtering; role checks for
/api/admin/** and /api/security/**; participant checks in selected ride/message
handlers; reset-code hashes, expiry, attempts and resend cooldown. Inspect the
code and tests rather than inferring complete protection from these mechanisms.

Observed production blockers in the current source:

- Public registration accepts ADMIN/SECURITY role values.
- Startup seed routines reset privileged account credentials.
- Returning User directly has no evidenced password-hash redaction in that entity.
- Face verification accepts uploads without biometric matching/liveness.
- Public auth/verification/test paths need a deliberate endpoint review.
- Client token storage, development HTTP/CORS, logs, uploads and audio retention
  require a deployment/privacy review; no production assurance is claimed.

Do not publish credentials, real student records, tokens or private recordings.
Use environment secrets and restrict seed routines to controlled development.
Record a negative-role/ownership test plan and assess retention/consent with the
university before processing sensitive identity/location/audio data. This is a
technical source review, not a legal compliance certification.
