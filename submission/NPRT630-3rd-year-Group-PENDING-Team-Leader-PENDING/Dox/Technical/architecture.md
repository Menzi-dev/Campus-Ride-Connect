# Architecture

Client entry: mobile/index.js → mobile/App.tsx. React Native/Expo screens use
React Navigation, Axios and shared UI components. AppLayout bounds the page and
owns one rider footer; screenChrome selects native/custom headers. Platform
device APIs provide camera/location/audio/file handling. Web maps use Leaflet.

Spring Boot HTTP controllers serve /api on port 8080. Core account, driver,
ride, message, SOS and reset-code entities use Spring Data JPA. JdbcTemplate
handles settings, saved-card metadata and selected reporting/payment operations.
MySQL stores relational records. JWT filtering supplies authentication; explicit
role rules protect admin/security URL prefixes. Inspect controller ownership
checks separately; authentication alone is not authorisation.

Client polling is used for important live views; do not infer operational
WebSockets from an included dependency or empty configuration file. SMTP and
map/routing services are external dependencies. Use a reachable LAN API address
on a real device and HTTPS in a future deployment.

UML/ERD assets and relationship caveats: report/assets and report pp.6–8/13–15.
Historical SQL does not fully match JPA mappings; see deployment.md.
