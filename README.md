# CampusConnect

Campus ride booking and safety app for riders, drivers, university administrators
and campus security. The client uses Expo/React Native and TypeScript; the backend
uses Spring Boot, Java 25 and MySQL. A local Python service compares face images.

## Source layout

- `mobile/index.js` registers `mobile/App.tsx`, the application's route registry.
- `mobile/src/screens` contains the screens registered by the app.
- `mobile/src/components` contains shared navigation, dialogs and face scanning.
- `mobile/src/hooks` manages map resizing and driver SOS recording/uploading.
- `mobile/src/services` provides authenticated API requests and device location.
- `backend/src/main/java/com/campusconnect` contains controllers, services,
  entities, repositories and authentication.
- `backend/src/main/resources` configures the backend.
- `backend/src/test` contains backend regression tests and isolated test settings.
- `backend/config` contains private local settings and public configuration examples.
- `backend/face-matcher` contains the Python matching service and its tests.
- `database/mysql` contains schema and migration scripts.
- `mobile/scripts` contains the HTTPS preview proxy and mocked browser checks.

Installed dependencies, local models, HTTPS certificates, build caches and
`backend/uploads` support development or application data. They are ignored by
Git. Uploaded driver documents and SOS evidence are application records.

The Markdown guides in `docs` explain API endpoints, configuration, verification,
security and testing. Report packages and generated document copies are excluded.

## Application flow

1. Registration collects account details, driver documents where applicable,
   and guided face enrollment. Riders verify their email; drivers require approval.
2. Login stores the JWT and user details, then opens the screen for the user's role.
3. Riders select a route and payment method, complete face verification, and
   submit an immediate or scheduled request. The backend creates the ride and
   payment record together and handles submission retries without duplicates.
4. An approved driver verifies their face before accepting an available request.
   The backend locks the ride during acceptance to prevent competing assignments.
5. Active-trip screens poll for updates and messages. Drivers progress the trip
   through pickup, arrival, start and completion; users can review and rate trips.
6. Rider and driver SOS flows send an alert and available location/audio evidence.
   Campus security reviews alerts and records their actions.
7. A backend scheduler dispatches verified scheduled rides when they become due.

## Run locally

Requirements: JDK 25, Maven, Node.js/npm, MySQL and Python with virtual environment
support. Run backend commands from `backend`, and client commands from `mobile`.
The examples below use PowerShell and the Windows `mvn.cmd`/`npm.cmd` launchers.

### Configure MySQL and email

From the repository root:

```powershell
Copy-Item backend/config/database.properties.example backend/config/database.properties
Copy-Item backend/config/mail.properties.example backend/config/mail.properties
```

Create the private files only if they do not already exist. Edit the database
file with your MySQL username and password. Edit the mail file with your SMTP
account, Google App Password and the frontend URL recipients can open.
Registration verification and password recovery need working email delivery.
The backend loads these private files from the repository or backend directory.

The default database is `campus_connect` on localhost:3306. To use a different
local database, set `SPRING_DATASOURCE_URL` in the backend terminal. Development
startup updates mapped tables and repairs additional columns/tables; SQL source
and migrations remain under `database/mysql`. Review migrations before applying
them to an existing database.

```powershell
Set-Location backend
mvn.cmd spring-boot:run
```

The API listens on port 8080. Backend startup also creates or updates the built-in
administrator and security accounts, including their passwords; see
`CampusConnectApplication.java` when reviewing that development behaviour.

### Face matcher setup and automatic startup

From the repository root, install it on a new machine:

```powershell
python -m venv .local-face/venv
& ./.local-face/venv/Scripts/python.exe -m pip install -r backend/face-matcher/requirements.txt
New-Item -ItemType Directory -Force .local-face/models
```

Download the model weights from OpenCV Zoo and retain their licenses:

- [YuNet](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet): save as `.local-face/models/yunet.onnx`.
- [SFace](https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface): save as `.local-face/models/sface.onnx`.

After installation, `mvn.cmd spring-boot:run` starts the matcher automatically
with the backend. It reuses an already running healthy matcher on port 8090.
The backend stops only a matcher that it started itself when shutting down.
Startup output is saved in `.local-face/matcher-backend.log`.

For manual troubleshooting, you can still start it separately:

```powershell
& ./.local-face/venv/Scripts/python.exe backend/face-matcher/server.py
```

It listens on 127.0.0.1:8090. Set `FACE_MATCHER_AUTO_START=false` if managing the
matcher separately. For a backend launched outside the source checkout, set
`FACE_MATCHER_PROJECT_ROOT` to the directory containing `backend` and `.local-face`.
Backend startup reports an error if the environment/models are missing or the
matcher does not become ready; check the setup and the log above.
Ride verification fails if the matcher is unavailable. Local face similarity and
browser movement checks do not provide spoof-resistant identity verification.

### Run the client

In another terminal:

```powershell
Set-Location mobile
npm.cmd ci
npm.cmd run web -- --port 8081
```

For native development, use `npm.cmd run android` or `npm.cmd run ios` with the
appropriate SDK. Guided face scanning currently runs in the web client; the
native component displays instructions to open the secure web link.

`mobile/src/services/ApiClient.ts` selects localhost for local web/iOS simulator
requests and 10.0.2.2 for Android emulators. Set its `LOCAL_IP` for a physical
phone using the computer's LAN address. Camera, microphone and browser location
need localhost or a trusted HTTPS origin.

For HTTPS previews, keep Expo on 8081 and the API on 8080. From the repository root:

```powershell
$env:TLS_KEY = '<path-to-your-local-key>'
$env:TLS_CERT = '<path-to-your-local-certificate>'
node mobile/scripts/secure-preview.cjs
```

The proxy listens on 8084 and forwards API/uploads to the backend and client
requests to Expo. Without TLS settings, use its HTTP port behind a trusted HTTPS
tunnel. `/phone` provides a phone-shaped preview of the web app.

## Verify changes

Client type checking includes unused local/parameter checks:

```powershell
Set-Location mobile
npm.cmd run typecheck
npx.cmd --no-install expo export --platform web --output-dir .expo/validation-export
```

Backend tests use `campus_connect_tests`; keep MySQL running and retain the
isolated URL in `backend/src/test/resources/application.properties`:

```powershell
Set-Location backend
mvn.cmd test
```

From the repository root, with the local models and sample fixtures installed:

```powershell
& ./.local-face/venv/Scripts/python.exe backend/face-matcher/test_matching.py
```

The matcher tests use `.local-face/lena.jpg` and `.local-face/messi5.jpg`, public
OpenCV sample images, rather than user enrollments.

Browser scripts use mocked API responses. From `mobile`, install their optional
Playwright tool in an ignored location and start Expo on 8083:

```powershell
npm.cmd install --prefix .expo/layout-tools --no-save --package-lock=false playwright
node .expo/layout-tools/node_modules/playwright/cli.js install chromium
npm.cmd run web -- --offline --port 8083
```

In another terminal in `mobile`:

```powershell
$env:PLAYWRIGHT_MODULE = (Resolve-Path '.expo/layout-tools/node_modules/playwright').Path
npm.cmd run check:responsive
npm.cmd run check:pages
npm.cmd run check:driver-sos
```

Set `APP_URL` when checking another local port. Physical camera, device layout
and multi-device trip behaviour still require manual testing. Saved card details
and payment records do not constitute an integrated payment processor.
