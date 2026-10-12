# Local database configuration

Database credentials are supplied through `DB_USERNAME` and `DB_PASSWORD`.
The tracked application configuration does not contain a database password.

For local development, copy `backend/config/database.properties.example` to
`backend/config/database.properties` and enter your own database credentials.
The real file is ignored by Git. The application loads it when launched from
the repository root or the backend directory.

Existing local credentials were retained in that private file during repository
preparation. Email credentials remain in the separately ignored
`backend/config/mail.properties` file.

Backend integration tests use `campus_connect_tests`. Start your local MySQL
service before running `mvn.cmd test`; do not replace the test database URL
with the application's `campus_connect` database.
