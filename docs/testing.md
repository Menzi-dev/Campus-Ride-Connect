# Testing evidence and commands

Pre-push checks on 13 October 2026:

- `npm.cmd run typecheck` passed.
- The 14 database-independent backend test classes passed: 63 checks, zero
  failures, errors or skipped checks.
- The complete backend run attempted 79 checks and reported 16 context errors
  because local `MYSQL80` was stopped. Starting that Windows service was not
  permitted by the session's service access. This is not a complete-suite pass;
  rerun `mvn.cmd test` with MySQL available and the dedicated test database.
- Database credentials were moved from tracked YAML files into ignored
  `backend/config/database.properties`; environment references and a safe
  example file are committed. Email credentials retain their separate config.

Historical evidence below records prior checks and should not be interpreted
as a fresh result for every current feature.

Fresh checks on 5 October 2026:

```powershell
# From mobile
npm.cmd run typecheck
# From backend: isolated service tests only
mvn.cmd -o "-Dtest=AuthServiceTest,PasswordResetServiceTest" test
```

TypeScript passed. Maven compiled and passed 9 tests, 0 failures/errors/skips
(AuthServiceTest: 2; PasswordResetServiceTest: 7). These tests mock repositories
and email, and do not verify SMTP delivery or database migrations.

Prior recorded session evidence on 4 October: responsive browser suite, detail
action suite and production web export passed. See responsive-layout.md for
local server/Playwright setup. Fixtures intercept API calls, so browser success
does not establish real backend integrations or participant satisfaction.

Later on 5 October, the complete backend suite passed: 23 tests, no failures or
errors. `backend/src/test/resources/application.properties` now sends integration
tests to `campus_connect_tests`, and account-creating controller tests roll back
their transactions. The pending-driver endpoint test now uses an authenticated
admin instead of expecting an anonymous request to succeed. Run `mvn.cmd test`
from `backend` with local MySQL available; never override the test datasource
with the application's `campus_connect` database.

The new multipart registration workflow tests verify that a new driver's
application appears in the admin queue and that approval/rejection updates both
the driver and user. Browser checks `mobile/scripts/check-admin-approvals.cjs`
verify automatic refresh, decisions, failure/retry and phone/tablet layouts.
`mobile/scripts/check-normal-rating.cjs` verifies a normal Home ride completion,
optional trimmed comments, rating-only submission, retry and responsive actions.
These browser scripts use synthetic intercepted API responses.

Driver SOS checks on 5 October: `DriverSosWorkflowTest` verifies that the assigned
driver's alert, GPS and reporter identity reach Security's existing queue,
Security can read synthetic evidence, and unrelated drivers cannot report or
attach evidence to the ride. All records roll back in `campus_connect_tests`;
the temporary evidence file is removed. No real alert or dispatch was sent.
`mobile/scripts/check-driver-sos.cjs` intercepts every API call and substitutes a
synthetic microphone to check placement, cancellation, sending failure/retry,
GPS/microphone denial, evidence streaming, release on return, the 60-second limit
and pending microphone permissions. Existing driver and Security page checks
also pass across seven screen sizes. Native device permissions/recording still
require physical-device validation.

Eight confirmed pending integration-test applications in the local app database
were archived on 5 October, retaining account records. The scoped archive SQL
and original-state restoration record are in `database/mysql/maintenance/`.

Manual/integration work remains: clean database installation, simultaneous
driver acceptance, ownership/role negatives, SMTP, native camera/audio/location,
keyboard/rotation, device file sharing, offline states and actual trip workflows.
Use synthetic alerts; never initiate a real emergency dispatch as a test.

Real-user study protocol and blank dataset: report/usability-study.md and
report/usability-results.csv. Do not report uncollected timings or satisfaction.
