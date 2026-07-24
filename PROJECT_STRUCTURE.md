# CampusConnect Project Structure

## Overview
This document lists the actual files and folders present in the CampusConnect repository so the structure is accurate and specific.

## Root Files and Folders
- [AI_PROJECT_PROMPT.md](AI_PROJECT_PROMPT.md) — AI project prompt and current implementation notes.
- [CampusConnect.code-workspace](CampusConnect.code-workspace) — VS Code workspace file.
- [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) — Project overview.
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) — This structure document.
- [pom.xml](pom.xml) — Root Maven project file.
- [project_file_inventory.txt](project_file_inventory.txt) — File inventory.
- [.gitignore](.gitignore) — Git ignore rules.
- [backend/](backend/) — Spring Boot backend application.
- [database/](database/) — MySQL database SQL scripts and migrations.
- [docs/](docs/) — Project documentation.
- [mobile/](mobile/) — React Native / Expo mobile application.

## Backend Files and Folders
### Root backend files
- [backend/pom.xml](backend/pom.xml)
- [backend/effective-pom](backend/effective-pom)
- [backend/docker/](backend/docker/)
  - [backend/docker/Dockerfile](backend/docker/Dockerfile)
  - [backend/docker/docker-compose.yml](backend/docker/docker-compose.yml)
- [backend/target/](backend/target/)

### Backend source tree (high level)
- [backend/src/main/java/com/campusconnect/CampusConnectApplication.java](backend/src/main/java/com/campusconnect/CampusConnectApplication.java)
- [backend/src/main/java/com/campusconnect/config/](backend/src/main/java/com/campusconnect/config/)
- [backend/src/main/java/com/campusconnect/controller/](backend/src/main/java/com/campusconnect/controller/)
- [backend/src/main/java/com/campusconnect/dto/](backend/src/main/java/com/campusconnect/dto/)
- [backend/src/main/java/com/campusconnect/entity/](backend/src/main/java/com/campusconnect/entity/)
- [backend/src/main/java/com/campusconnect/exception/](backend/src/main/java/com/campusconnect/exception/)
- [backend/src/main/java/com/campusconnect/mapper/](backend/src/main/java/com/campusconnect/mapper/)
- [backend/src/main/java/com/campusconnect/repository/](backend/src/main/java/com/campusconnect/repository/)
- [backend/src/main/java/com/campusconnect/security/](backend/src/main/java/com/campusconnect/security/)
- [backend/src/main/java/com/campusconnect/service/](backend/src/main/java/com/campusconnect/service/)
- [backend/src/main/java/com/campusconnect/util/](backend/src/main/java/com/campusconnect/util/)
- [backend/src/main/java/com/campusconnect/validation/](backend/src/main/java/com/campusconnect/validation/)
- [backend/src/main/java/com/campusconnect/websocket/](backend/src/main/java/com/campusconnect/websocket/)
- [backend/src/main/resources/application.yml](backend/src/main/resources/application.yml)
- [backend/src/main/resources/application-dev.yml](backend/src/main/resources/application-dev.yml)
- [backend/src/main/resources/application-prod.yml](backend/src/main/resources/application-prod.yml)
- [backend/src/main/resources/messages.properties](backend/src/main/resources/messages.properties)
- [backend/src/test/java/com/campusconnect/](backend/src/test/java/com/campusconnect/)

## Mobile App Files and Folders
### Root mobile files
- [mobile/App.tsx](mobile/App.tsx)
- [mobile/app.json](mobile/app.json)
- [mobile/babel.config.js](mobile/babel.config.js)
- [mobile/index.js](mobile/index.js)
- [mobile/MinimalTest.tsx](mobile/MinimalTest.tsx)
- [mobile/SimpleTest.tsx](mobile/SimpleTest.tsx)
- [mobile/TestConnectionWeb.tsx](mobile/TestConnectionWeb.tsx)
- [mobile/package.json](mobile/package.json)
- [mobile/package-lock.json](mobile/package-lock.json)
- [mobile/tsconfig.json](mobile/tsconfig.json)
- [mobile/.expo/](mobile/.expo/)
- [mobile/node_modules/](mobile/node_modules/)
- [mobile/public/](mobile/public/)
- [mobile/web/](mobile/web/)

### Mobile source tree
- [mobile/src/assets/](mobile/src/assets/)
- [mobile/src/components/](mobile/src/components/)
  - [mobile/src/components/Button.tsx](mobile/src/components/Button.tsx)
  - [mobile/src/components/BottomSheetModal.tsx](mobile/src/components/BottomSheetModal.tsx)
  - [mobile/src/components/Toast.tsx](mobile/src/components/Toast.tsx)
  - [mobile/src/components/DriverCard.tsx](mobile/src/components/DriverCard.tsx)
  - [mobile/src/components/MapView.tsx](mobile/src/components/MapView.tsx)
  - [mobile/src/components/RideCard.tsx](mobile/src/components/RideCard.tsx)
  - [mobile/src/components/SosButton.tsx](mobile/src/components/SosButton.tsx)
  - [mobile/src/components/VerificationChecklist.tsx](mobile/src/components/VerificationChecklist.tsx)
- [mobile/src/context/](mobile/src/context/)
- [mobile/src/hooks/](mobile/src/hooks/)
- [mobile/src/navigation/](mobile/src/navigation/)
  - [mobile/src/navigation/AppNavigator.tsx](mobile/src/navigation/AppNavigator.tsx)
  - [mobile/src/navigation/AuthNavigator.tsx](mobile/src/navigation/AuthNavigator.tsx)
  - [mobile/src/navigation/MainNavigator.tsx](mobile/src/navigation/MainNavigator.tsx)
  - [mobile/src/navigation/RootNavigator.tsx](mobile/src/navigation/RootNavigator.tsx)
- [mobile/src/screens/](mobile/src/screens/)
  - [mobile/src/screens/ActiveRidesMonitorScreen.tsx](mobile/src/screens/ActiveRidesMonitorScreen.tsx)
  - [mobile/src/screens/ActiveTripScreen.tsx](mobile/src/screens/ActiveTripScreen.tsx)
  - [mobile/src/screens/AdminDashboardScreen.tsx](mobile/src/screens/AdminDashboardScreen.tsx)
  - [mobile/src/screens/CreateAccountScreen.tsx](mobile/src/screens/CreateAccountScreen.tsx)
  - [mobile/src/screens/DriverDashboardScreen.tsx](mobile/src/screens/DriverDashboardScreen.tsx)
  - [mobile/src/screens/DriverVerificationScreen.tsx](mobile/src/screens/DriverVerificationScreen.tsx)
  - [mobile/src/screens/HomeScreen.tsx](mobile/src/screens/HomeScreen.tsx)
  - [mobile/src/screens/LandingScreen.tsx](mobile/src/screens/LandingScreen.tsx)
  - [mobile/src/screens/LoginScreen.tsx](mobile/src/screens/LoginScreen.tsx)
  - [mobile/src/screens/TestConnectionScreen.tsx](mobile/src/screens/TestConnectionScreen.tsx)
  - [mobile/src/screens/TripHistoryScreen.tsx](mobile/src/screens/TripHistoryScreen.tsx)
- [mobile/src/services/](mobile/src/services/)
  - [mobile/src/services/ApiClient.ts](mobile/src/services/ApiClient.ts)
  - [mobile/src/services/AuthService.ts](mobile/src/services/AuthService.ts)
  - [mobile/src/services/SocketService.ts](mobile/src/services/SocketService.ts)
  - [mobile/src/services/PaymentService.ts](mobile/src/services/PaymentService.ts)
  - [mobile/src/services/RideService.ts](mobile/src/services/RideService.ts)
- [mobile/src/theme/](mobile/src/theme/)
- [mobile/src/utils/](mobile/src/utils/)

## Database Files
- [database/mysql/schema.sql](database/mysql/schema.sql)
- [database/mysql/seed.sql](database/mysql/seed.sql)
- [database/mysql/procedures.sql](database/mysql/procedures.sql)
- [database/mysql/views.sql](database/mysql/views.sql)
- [database/mysql/migrations/001_init_schema.sql](database/mysql/migrations/001_init_schema.sql)

## Documentation Files
- [docs/api-spec.md](docs/api-spec.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/deployment.md](docs/deployment.md)
- [docs/requirements.md](docs/requirements.md)
- [docs/security.md](docs/security.md)
- [docs/testing.md](docs/testing.md)

## Notes
- The repo does not contain a top-level `web/` folder; `mobile/web/` is the actual web page asset location for the mobile app.
- The root `pom.xml` exists alongside `backend/pom.xml`.
- The backend source package is `backend/src/main/java/com/campusconnect/`.
- The mobile app includes many screens under [mobile/src/screens/](mobile/src/screens/) and backend controllers under [backend/src/main/java/com/campusconnect/controller/](backend/src/main/java/com/campusconnect/controller/).
