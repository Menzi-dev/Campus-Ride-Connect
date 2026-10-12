# Persistent Gmail email and account verification

## What caused the restart problem

The old `backend/run-with-gmail.ps1` prompted for a password, set `GMAIL_APP_PASSWORD` only in its process, and cleared it when the launcher exited. `application.yml` used `${GMAIL_APP_PASSWORD:}` with an empty fallback. Ordinary `mvn spring-boot:run` or an IDE launch therefore had no SMTP password. Inspection found no password in the current process/user/machine environment and no private persisted mail configuration. This explains the restart failure in this setup; no evidence establishes that Gmail revoked the previous App Password. Historical SMTP authentication/delivery cannot be reconstructed from this inspection.

Spring Boot now imports private properties automatically, using its built-in configuration system (no dotenv dependency). Configuration is loaded on every JVM start, independently of the terminal's environment variables.

## One-time setup in VS Code

Run in a PowerShell terminal:

```powershell
cd C:\Users\Admin\Downloads\Campus-Ride-Connect\Campus-Ride-Connect
.\backend\configure-email.ps1
```

Enter the app's current HTTPS **root** URL when prompted, then the **existing** Google App Password for `saneledlomo08@gmail.com`. Password entry is hidden. Do not paste it into chat. The script removes Google's display spaces, saves `backend/config/mail.properties`, and restricts its Windows file permissions. This file is ignored by Git. The script refuses to overwrite an existing configuration; edit the private file directly to update it.

Alternatively copy `backend/config/mail.properties.example` to `backend/config/mail.properties`, replace the placeholders locally, and keep the real file private. The frontend never receives or reads these values.

| Setting | Placeholder/example | Purpose |
| --- | --- | --- |
| `GMAIL_USERNAME` | `saneledlomo08@gmail.com` | Existing Gmail sender; must own the App Password |
| `GMAIL_APP_PASSWORD` | `YOUR_EXISTING_GOOGLE_APP_PASSWORD_WITHOUT_SPACES` | Private 16-letter App Password; use the existing one |
| `APP_PUBLIC_URL` | `https://YOUR_CURRENT_HTTPS_APP_URL` | Frontend origin reachable from the recipient's device; no query/fragment, preferably no path |
| `APP_MAIL_REQUIRED` | `true` | Fail startup clearly when email credentials are absent |
| `EMAIL_VERIFICATION_EXPIRY_MINUTES` | `60` | Verification link lifetime, minimum 5 minutes |
| `EMAIL_VERIFICATION_COOLDOWN_SECONDS` | `60` | Persistent per-account resend cooldown, minimum 60 seconds |

Spring imports `${user.home}/.campusconnect/mail.properties`, then `./config/mail.properties`, then `./backend/config/mail.properties` when those files exist. The latter two support launches from the backend or repository root. Environment variables override file values according to Spring's normal precedence; remove stale environment overrides if a file edit seems ineffective. Other IDE working directories should use the user-home location or an explicit `SPRING_CONFIG_IMPORT` pointing to the private file. Do not commit credentials in VS Code launch settings.

Gmail uses `smtp.gmail.com`, port **587**, authenticated SMTP, required STARTTLS, certificate hostname checks, and 5-second network timeouts. The From address is always the configured Gmail username. Google requires an App Password for this setup with 2-Step Verification. An ordinary application restart does not require a new App Password. If authentication fails, check that the stored password belongs to the sender and has not been revoked; update the private file with a valid existing password. Only create a replacement through Google account settings if the existing password is unavailable or revoked. [Google SMTP settings](https://support.google.com/mail/answer/7104828), [Google App Password help](https://support.google.com/accounts/answer/185833), [Spring Boot external configuration](https://docs.spring.io/spring-boot/3.5/reference/features/external-config.html).

## Start the applications

Stop any backend already using port 8080. In the repository-root terminal:

```powershell
.\backend\run-with-gmail.ps1
```

The launcher no longer prompts for credentials. It starts Maven from the backend directory and requires valid, present mail configuration. You can also run the usual command after configuring the private file:

```powershell
cd backend
mvn.cmd spring-boot:run
```

In a second terminal:

```powershell
cd C:\Users\Admin\Downloads\Campus-Ride-Connect\Campus-Ride-Connect\mobile
npm.cmd run web
```

For the same-origin HTTPS preview, keep the existing proxy and tunnel running. To start the proxy in another terminal from the repository root:

```powershell
node .\mobile\scripts\secure-preview.cjs
```

It listens on port 8084 by default, forwarding web traffic to 8081 and API traffic to 8080. The existing phone presentation can also run on 8085 with `SECURE_PREVIEW_PORT=8085`. `http://localhost:8085` is appropriate only when testing on the same computer. For phones, configure the current HTTPS tunnel origin in `APP_PUBLIC_URL`. Temporary tunnel URLs change when recreated: update the private file and restart the backend before sending new links. Old emails referencing an expired tunnel cannot reach the app; request another email after updating the URL.

## Account workflow

Registration verification emails now default to a six-digit code without external URLs, following the format of the working password-reset emails. Enter the code in the app and select **Verify email**. Codes are BCrypt-hashed, expire after ten minutes (or the shorter configured link lifetime), have a five-attempt limit and share single-use consumption with the independent random link token. Resending invalidates both previous challenges. Password-reset codes still use their own table and validation.

Set EMAIL_VERIFICATION_DELIVERY_MODE=link in private backend configuration to restore the email's **Verify email** link button. The default is code. Existing links continue working regardless of delivery mode. This change avoids relying on temporary tunnel URLs in email content; university filtering remains a possible delivery issue, not a confirmed cause. Gmail accepted the earlier registration messages, which does not prove inbox delivery.


1. Registration preserves the existing account, role, driver approval, document and face enrollment logic. It explicitly stores `email_verified = false` and creates a 32-byte cryptographically random verification token.
2. Only its SHA-256 hash and a BCrypt hash of the accompanying code are stored. A branded multipart HTML/plain-text verification code email is sent **after the registration transaction commits**. A failed SMTP send never removes the account; after fixing SMTP, request a new verification link.
3. Enter the emailed code on the app's verification screen and tap **Verify email**. In optional link mode, the email link opens that screen automatically. The token is in a URL fragment, which is not sent in HTTP URLs or access logs. The app removes the fragment from browser history and passes the token in a POST body, without logging it.
4. The backend locks the account/token, checks the hash, registered email, expiry and unused status, then records email verification and consumes the token. Invalid, expired and reused links get a clear error and a resend option.
5. The success screen offers **Go to Login**. Unverified accounts cannot log in or use protected endpoints even with a previously issued JWT. New drivers skip email verification and still need admin approval; registration returns an authenticated session for viewing the pending approval screen.
6. Resend responds generically for unknown, verified and unverified addresses. A database-backed cooldown prevents repeated messages, and resending invalidates the previous link.

Existing accounts have a NULL verification field and retain their previous access; this is a deliberate compatibility exception, not a claim that their email addresses were checked. Seeded administrators/security accounts remain usable. Newly registered rider and staff accounts must verify. Drivers are exempt from email verification and go directly to the administrator-approval waiting screen; their email is not falsely marked verified. Driver approval/rejection emails and password reset remain enabled. There is no social login implementation in this project.

The existing password reset code flow uses the same `EmailService`, preserving its independent BCrypt-hashed six-digit codes, ten-minute expiry, five-attempt limit and single-use password reset. Resetting a password does not verify an email. Reset codes cannot serve as verification tokens.

## Driver approval/rejection emails

An admin decision updates the driver/user status and inserts an email notification in the same database transaction. A scheduled worker checks the persistent queue every 15 seconds, sends the branded approval or rejection message, and records successful SMTP acceptance. Missing configuration leaves messages queued. Failures retry with increasing delay, capped at one hour. Restarting the app preserves queued notifications. Repeating the same decision does not enqueue another email.

Only decisions made after this feature is installed generate notifications; historical decisions are not emailed automatically. SMTP acceptance is not proof of inbox delivery. Delivery is at least once: a crash after SMTP acceptance but before the database commit could produce a duplicate on retry. Verification emails have no persisted plaintext-token queue; request a fresh link after delivery failure.

## Database and files

Development retains the existing `ddl-auto: update`; Hibernate adds the nullable verification column and two new tables without deleting user data. For deployments with managed migrations, apply `database/mysql/migrations/018_email_verification_and_driver_emails.sql` once **instead of** letting Hibernate create these fields. No destructive schema changes or bulk unverified backfill were added.

| Files | Change |
| --- | --- |
| `backend/src/main/resources/application.yml`, `.gitignore` | Persistent private config import, required TLS and secret-file exclusion |
| `backend/config/mail.properties.example`, `configure-email.ps1`, `run-with-gmail.ps1` | Placeholder template, one-time secure setup, repeatable startup |
| `EmailService.java`, `PasswordResetService.java` | Shared branded email delivery and sanitized diagnostics; existing recovery preserved |
| `User.java`, `AuthService.java`, `JwtAuthenticationFilter.java`, `AuthController.java` | Verification state, registration and login policy, public confirmation/resend endpoints; password hashes hidden from JSON |
| `EmailVerificationToken.java`, its repository and `EmailVerificationService.java` | Hashed single-use expiring tokens, transactional validation and resend cooldown |
| `DriverDecisionEmail.java`, its repository/service, `DriverRepository.java`, `AdminController.java` | Persistent decision email queue and idempotent admin decisions |
| `mobile/App.tsx`, `EmailVerificationScreen.tsx`, registration/login screens, `ApiClient.ts`, `screenChrome.ts` | Verification link handling, resend/success UI and registration/login routing |
| Migration 018, backend tests, README and email guides | Non-destructive deployment schema, coverage and exact setup instructions |

## Checks and manual delivery test

Automated checks completed: **78 backend tests passed**, including two independent configuration loads, missing-config/authentication diagnostics, registration events, verification expiry/reuse/invalid tokens, generic resend/cooldown, backend JWT/login restrictions, legacy access, password-reset isolation, driver decision queue/retry/idempotency and existing app workflows. TypeScript checks passed. PowerShell setup/startup scripts parse successfully. Git ignores the real mail.properties but includes the placeholder template. Gmail TCP port 587 was reachable.

**Gmail authentication has now passed**, and Gmail accepted real registration emails. Inbox delivery still requires confirmation by the recipient. SMTP failures log only categories and exception class names, never passwords, raw tokens or complete mail exceptions.

After one-time setup:

1. Restart the backend. Confirm it logs that SMTP settings are loaded (this checks configuration presence, not Gmail authentication).
2. Register using an inbox you control. Confirm email verification is required; try logging in before verification and expect the verification screen.
3. Enter the received six-digit code in the app and select **Verify email**. Confirm success and login access. Reusing a code or linked token must fail. Optional link-mode emails also provide a verification button.
4. Request another email after the cooldown. Confirm the old code/link no longer works. Let a code expire and confirm the expiry message.
5. Use Forgot password on the login page, receive its code, set a new password, and log in. Resetting an unverified account must still require email verification.
6. Register a driver, then approve or reject their application as admin. Confirm the decision email arrives; approval must not bypass email verification.
7. Stop and restart the backend from a fresh VS Code terminal. Repeat reset and verification mail delivery without entering the password again.

If configuration is present but delivery fails, use the sanitized backend category to distinguish authentication errors from connection/TLS/provider errors. Check the correct sender/App Password, network access, provider limits and spam folder. Never share the password or verification/reset tokens when reporting an error.

For deployments using managed migrations, apply migration 019 once to add the verification code hash, expiry and attempt count fields. Local Hibernate update creates them automatically. Old verification tokens need a resend to obtain a code.
