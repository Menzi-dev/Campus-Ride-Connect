# Testing evidence and commands

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

Historical Surefire controller reports include a failure in
AdminControllerPendingDriversTest. The full suite was not rerun here: some
integration tests create accounts. Use a disposable test database, inspect test
side effects and rerun the full suite before final submission.

Manual/integration work remains: clean database installation, simultaneous
driver acceptance, ownership/role negatives, SMTP, native camera/audio/location,
keyboard/rotation, device file sharing, offline states and actual trip workflows.
Use synthetic alerts; never initiate a real emergency dispatch as a test.

Real-user study protocol and blank dataset: report/usability-study.md and
report/usability-results.csv. Do not report uncollected timings or satisfaction.
