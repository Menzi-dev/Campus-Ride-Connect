# Local execution and environment configuration

Project manifest: Java 25, Spring Boot 3.5.0; Expo 57, React Native 0.86,
React 19.2 and TypeScript. Install a compatible Node/npm environment and MySQL.
Do not treat this as a tested public-hosting guide.

From the repository root:

```powershell
Set-Location backend
mvn.cmd spring-boot:run
```

In a second terminal, from mobile:

```powershell
npm.cmd ci
npm.cmd run web -- --port 8083
```

If a lockfile is absent or inconsistent, resolve dependency versions deliberately
rather than silently changing them. The backend listens on 8080. ApiClient.ts
uses localhost for web/iOS simulator, 10.0.2.2 for Android emulator and an optional
LOCAL_IP for a physical phone. Phone and computer need a reachable network path.

Configure development database and JWT settings externally. Spring environment
overrides include SPRING_DATASOURCE_URL, SPRING_DATASOURCE_USERNAME,
SPRING_DATASOURCE_PASSWORD and the application JWT property overrides matching
application.yml. Configure SMTP through the documented run-with-gmail.ps1
launcher and GMAIL_USERNAME/GMAIL_APP_PASSWORD; see password-reset-email.md.
No credential values should be copied into the report or submission.

Database warning: ddl-auto:update and runtime repair exist, but schema.sql uses
rides.id/duration_minutes while the entity uses ride_id/duration_min. A payments
creation script is not evidenced. Historical migration numbers overlap and
some scripts are non-idempotent. fix_rides_table.sql rebuilds the table. Do not
execute every script blindly or against important data. Confirm a disposable
database with SHOW CREATE TABLE, consolidate migrations and test clean install.

For a production deployment, first address security.md, migrations, TLS, secrets,
backup/restore, controlled seed routines, logging and external-service policies.
Public deployment was not performed by the report preparation.
