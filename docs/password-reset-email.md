# Password Reset Email

Password reset codes are sent by the Spring Boot backend through Gmail SMTP. The sender is the Gmail address entered into the local launcher; the recipient is the email address entered on the Login screen. The App Password must belong to that exact sender account.

The backend reads `GMAIL_APP_PASSWORD` from its process environment. Do not put the app password in `application.yml`, source code, or a committed file. The repository `.gitignore` already excludes `.env` files.

If an App Password has been shared in chat or another public location, revoke it in Google Account security settings and generate a replacement. Stop any backend already using port 8080 before starting the configured backend.

For local development, stop the existing backend and run the launcher in a visible PowerShell terminal. From the project root use:

```powershell
.\backend\run-with-gmail.ps1
```

If the terminal is already in the `backend` folder, use:

```powershell
.\run-with-gmail.ps1
```

The launcher checks port 8080, asks for the Gmail sender address and its App Password (hidden input), removes Google's display spaces, and starts Spring Boot with those settings in its process environment.

The account must have 2-Step Verification enabled and App Passwords available. In production, configure `GMAIL_APP_PASSWORD` in the hosting platform's secret/environment settings.

The `password_reset_codes` table is defined by `database/mysql/migrations/017_create_password_reset_codes.sql`. Apply that migration to an existing database; local JPA `ddl-auto: update` also creates the entity table during development.