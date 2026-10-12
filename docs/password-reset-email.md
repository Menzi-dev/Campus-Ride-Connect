# Password Reset Email

Forgot password, email verification and driver approval/rejection messages now share the backend EmailService and persistent Gmail settings.

Run `backend/configure-email.ps1` once to save your existing App Password privately, then use `backend/run-with-gmail.ps1` for future starts. Credentials are loaded automatically; the launcher no longer prompts each time.

See [persistent email setup and account verification](email-account-verification.md) for exact commands, configuration variables, Gmail settings, verification/security policy, migration guidance and manual delivery tests.

Password reset retains its separate hashed six-digit codes, ten-minute expiry, resend cooldown, five-attempt limit and single-use reset. A password reset never marks an email verified. The existing password_reset_codes table remains in use.
