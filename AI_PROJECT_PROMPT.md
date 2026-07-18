# CampusConnect – Complete Project Prompt for AI

## 1. Project Overview
CampusConnect is a full-stack student ride-sharing and campus safety application. It is designed to support:
- student ride booking and matching
- driver onboarding and verification
- live trip monitoring
- emergency SOS alerts
- university administration controls
- security operations and incident reports
- face verification and document verification
- notifications and payments

This repository contains:
- a Spring Boot backend in Java
- a React Native mobile frontend in TypeScript
- database SQL scripts and migration placeholders
- documentation files for requirements, architecture, API design, deployment, security, and testing

## 2. Top-Level Project Structure
Root folders and files:
- `AI_PROJECT_PROMPT.md` – this prompt file
- `CampusConnect.code-workspace` – VS Code workspace file
- `PROJECT_STRUCTURE.md` – intended project architecture scaffold
- `pom.xml` – Maven root project file
- `backend/` – Spring Boot backend application
  - `pom.xml` – backend Maven dependencies
  - `src/` – backend source files
  - `docker/` – empty backend Docker placeholders
  - `effective-pom/` – generated effective POM output
  - `target/` – Maven build output
- `database/` – SQL scripts and migrations
  - `mysql/` – database files
- `docs/` – project documentation
- `mobile/` – React Native mobile app
  - `.expo/` – Expo config and cache files
  - `node_modules/` – installed npm packages
  - `src/` – mobile application source files

Not present in this repository:
- no root-level `docker/` folder
- no root-level `README.md`
- no `mvnw` or `mvnw.cmd` wrapper in backend or root
- no root-level `.gitignore` file visible

## 3. Backend Structure and Purpose
The backend is located in [backend/](backend/).

### Main backend entry point
- [backend/src/main/java/com/campusconnect/CampusConnectApplication.java](backend/src/main/java/com/campusconnect/CampusConnectApplication.java)
  - Main Spring Boot application class
  - Starts the server
  - Annotated with @SpringBootApplication

### Backend package structure
- [backend/src/main/java/com/campusconnect/config/](backend/src/main/java/com/campusconnect/config/)
  - Application configuration classes
  - Security config
  - WebSocket config
  - JWT filter setup

- [backend/src/main/java/com/campusconnect/controller/](backend/src/main/java/com/campusconnect/controller/)
  - REST API controllers
  - Handles endpoint requests for auth, users, rides, SOS, security, admin, trips, documents, notifications, and test endpoints

- [backend/src/main/java/com/campusconnect/service/](backend/src/main/java/com/campusconnect/service/)
  - Business logic layer
  - Contains services for authentication, ride matching, driver approval, face verification, payments, notifications, security monitoring, and admin workflows

- [backend/src/main/java/com/campusconnect/repository/](backend/src/main/java/com/campusconnect/repository/)
  - Spring Data JPA repositories
  - Interacts with the MySQL database for persistence

- [backend/src/main/java/com/campusconnect/entity/](backend/src/main/java/com/campusconnect/entity/)
  - JPA entity classes representing database tables
  - Example entities include User, Driver, Ride, Rating, SosAlert, Document, Payment, University, SafeZone, AuditLog

- [backend/src/main/java/com/campusconnect/dto/](backend/src/main/java/com/campusconnect/dto/)
  - Data Transfer Objects used to receive and send API payloads

- [backend/src/main/java/com/campusconnect/security/](backend/src/main/java/com/campusconnect/security/)
  - JWT token generation and validation logic
  - Authentication entry point and custom user details services

- [backend/src/main/java/com/campusconnect/websocket/](backend/src/main/java/com/campusconnect/websocket/)
  - WebSocket gateway support for live ride and safety messaging

- [backend/src/main/java/com/campusconnect/exception/](backend/src/main/java/com/campusconnect/exception/)
  - Centralized exception handling for API errors

- [backend/src/main/java/com/campusconnect/util/](backend/src/main/java/com/campusconnect/util/)
  - Helper classes for OCR, encryption, geolocation, file storage, date/time utilities

- [backend/src/main/java/com/campusconnect/validation/](backend/src/main/java/com/campusconnect/validation/)
  - Custom validation logic for university email rules and input constraints

## 4. Backend Runtime Configuration
The backend uses Spring Boot and is configured in [backend/src/main/resources/application.yml](backend/src/main/resources/application.yml).

### Database connection details
The application is configured to connect to MySQL using:
- host: localhost
- port: 3306
- database name: campus_connect
- username: root
- password: s1gwebela
- JDBC URL: jdbc:mysql://localhost:3306/campus_connect?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC

### Important runtime settings
- server port: 8080
- server address: 0.0.0.0
- JPA Hibernate ddl-auto: validate
- SQL logging enabled
- JWT secret configured in the same file
- multipart upload size limit: 10MB

### Backend Docker support status
- [backend/docker/Dockerfile](backend/docker/Dockerfile) exists but is currently empty.
- [backend/docker/docker-compose.yml](backend/docker/docker-compose.yml) exists but is currently empty.
- There is no active root `docker/` deployment folder in the repository.

## 5. Mobile Frontend Structure and Purpose
The mobile app is located in [mobile/](mobile/).

### Main app entry point
- [mobile/App.tsx](mobile/App.tsx)
  - Root React Native application entry
  - Currently displays [mobile/src/screens/TestConnectionScreen.tsx](mobile/src/screens/TestConnectionScreen.tsx)

### Mobile app package files
- [mobile/package.json](mobile/package.json)
  - Expo/React Native dependencies
  - Scripts for starting the app

- [mobile/app.json](mobile/app.json)
  - Expo project settings

- [mobile/babel.config.js](mobile/babel.config.js)
  - Babel configuration

- [mobile/tsconfig.json](mobile/tsconfig.json)
  - TypeScript configuration

- [mobile/.env](mobile/.env)
  - Environment variables placeholder for frontend configuration

### Mobile app source folders
- [mobile/src/navigation/](mobile/src/navigation/)
  - Screen navigation stacks
  - AppNavigator, AuthNavigator, MainNavigator, RootNavigator

- [mobile/src/screens/](mobile/src/screens/)
  - UI screens for login, signup, home, ride booking, driver dashboard, trip monitoring, payments, profile, admin panels, SOS alerts, incident reports, user management, security dashboard, and more

- [mobile/src/components/](mobile/src/components/)
  - Reusable UI components such as RideCard, DriverCard, MapView, SosButton, VerificationChecklist

- [mobile/src/services/](mobile/src/services/)
  - API connection and integration services
  - Includes ApiClient, AuthService, RideService, SocketService, FaceRecognitionService, NotificationService, PaymentService, StorageService

- [mobile/src/context/](mobile/src/context/)
  - Global React context providers for authentication, ride state, and socket events

- [mobile/src/hooks/](mobile/src/hooks/)
  - Custom hooks for auth, location tracking, and face recognition

- [mobile/src/theme/](mobile/src/theme/)
  - App theme and styling constants

- [mobile/src/utils/](mobile/src/utils/)
  - Validation helpers and app constants

## 6. Current Mobile Connection Flow
The app currently uses [mobile/src/services/ApiClient.ts](mobile/src/services/ApiClient.ts) as the central HTTP client.

### API client behavior
- Uses Axios
- Base URL: http://10.0.2.2:8080/api for Android Emulator
- Adds Authorization Bearer token from AsyncStorage if present
- Handles 401 errors by removing the auth token

### Connection test screen
- [mobile/src/screens/TestConnectionScreen.tsx](mobile/src/screens/TestConnectionScreen.tsx)
  - Tests backend connectivity at /test/connection
  - Tests hello endpoint at /test/hello
  - Fetches users from /users
  - Useful for verifying the backend is responding before wiring the rest of the app

## 7. Database Structure and SQL Files
The database files are in [database/mysql/](database/mysql/).

### SQL files
- [database/mysql/schema.sql](database/mysql/schema.sql)
  - Intended schema definition for app entities

- [database/mysql/seed.sql](database/mysql/seed.sql)
  - Seed data for universities, roles, and admin accounts

- [database/mysql/procedures.sql](database/mysql/procedures.sql)
  - Stored procedures for ride matching, trip lifecycle actions, and reporting

- [database/mysql/views.sql](database/mysql/views.sql)
  - Database views for trip history, active rides, and admin reporting

- [database/mysql/migrations/001_init_schema.sql](database/mysql/migrations/001_init_schema.sql)
  - Initial SQL migration entry point

### Database file status
- These SQL files exist, but several are currently placeholders or empty and may need actual schema/content added.

### Expected database entities
The intended database model includes tables for:
- users
- drivers
- rides
- ratings
- SOS alerts
- face verification records
- documents
- payments
- universities
- safe zones
- audit logs

## 8. Documentation Files
The documentation folder contains files for the intended product and implementation spec:
- [docs/requirements.md](docs/requirements.md) – functional and non-functional requirements
- [docs/architecture.md](docs/architecture.md) – system architecture overview
- [docs/api-spec.md](docs/api-spec.md) – API contract
- [docs/security.md](docs/security.md) – security design
- [docs/deployment.md](docs/deployment.md) – deployment guidance
- [docs/testing.md](docs/testing.md) – testing strategy

### Documentation status
- Some documentation files exist as placeholders and may be empty or incomplete.

## 9. What the Application Is Meant to Do
The app is meant to be a campus transportation and safety platform for students and university operations. In practice, the intended feature set includes:
- rider registration and login
- driver registration and verification
- booking a ride
- matching with a driver
- live trip tracking
- emergency SOS
- ride history and ratings
- payment handling
- admin oversight and security monitoring
- university-based access control

## 10. What Is Already Implemented vs What Is Scaffolded
### Currently implemented / visible
- Spring Boot backend scaffold
- Maven backend build configuration
- MySQL database connection configuration
- React Native mobile app scaffold
- navigation and screen structure
- test connection screen
- service files and context/hook structure
- SQL file placeholders and migration files

### Likely scaffold/incomplete areas
- Many backend service files may not be fully implemented
- Some screens exist but may not yet be fully linked into navigation
- Database SQL files are mostly placeholders and require actual content
- Backend Docker files are empty and not ready for container deployment
- No Maven wrapper (`mvnw`) is provided, so local Maven is required
- Authentication, ride logic, and real-time features may need implementation

## 11. How to Build and Run the App
### Backend
From the backend folder:
- cd backend
- mvn spring-boot:run

The backend should start on port 8080 and connect to MySQL on localhost:3306.

### Mobile app
From the mobile folder:
- npm install
- npx expo start

For Android emulator, the mobile app is expected to call the backend at:
- http://10.0.2.2:8080/api

## 12. Prompt for an AI Assistant
Use this prompt with an AI assistant:

"Analyze this CampusConnect repository and help me complete the full application. This is a full-stack student ride-sharing and campus safety system with a Java Spring Boot backend, a React Native TypeScript mobile frontend, and a MySQL database. The backend should run on port 8080 and connect to MySQL at localhost:3306 using the database campus_connect. The mobile app should communicate with the backend through the existing API client using http://10.0.2.2:8080/api for Android emulator testing. The repository currently lacks a Maven wrapper, root-level Docker deployment files, and some SQL/documentation content is placeholder or empty. Implement or complete the missing backend logic, frontend screens, navigation, services, database schema, and documentation so the app works end-to-end. Preserve the existing project structure and architecture, and make the app functional rather than just scaffolded."

## 12. Important Guidance for AI
When continuing development, AI should treat this repository as a full-stack campus mobility platform with:
1. a Java Spring Boot backend
2. a React Native TypeScript frontend
3. a MySQL persistence layer
4. JWT-based authentication and authorization
5. real-time communication via WebSocket
6. security-sensitive features like SOS alerts, face verification, and document upload

## 13. Prompt for an AI Assistant
Use the following prompt with any coding assistant:

"Analyze this CampusConnect repository and help me complete the full application. Understand that this is a full-stack student ride-sharing and campus safety system with a Java Spring Boot backend, a React Native TypeScript mobile frontend, and a MySQL database. The backend should expose REST APIs and WebSocket support, connect to MySQL at localhost:3306 with the database campus_connect, and serve the app on port 8080. The mobile app should communicate with the backend through ApiClient using http://10.0.2.2:8080/api for Android emulator testing. Implement or complete the missing backend logic, frontend screens, navigation, services, and database schema so the app works end-to-end. Preserve the existing structure, follow the current architecture, and make the app functional rather than just scaffolded."

## 14. Claude / ChatGPT Optimized Prompt
Use this prompt with Claude or ChatGPT for best results:

"You are working on the CampusConnect repository, a full-stack South African university ride-sharing app. The repository contains a Java Spring Boot backend under `backend/`, a React Native Expo mobile app under `mobile/`, and database SQL scripts under `database/mysql/`. The backend is configured in `backend/src/main/resources/application.yml` to connect to MySQL at `localhost:3306` using the `campus_connect` database, with credentials `root` and `s1gwebela`.

The frontend currently uses `mobile/src/services/ApiClient.ts` and the default app entry is `mobile/App.tsx`, which loads `mobile/src/screens/TestConnectionScreen.tsx`. The repository does not include a root-level Docker deployment folder, and backend Docker files are empty placeholders. Many SQL files and documentation files may be placeholders or incomplete.

Your task is to analyze the repository and complete the application so it works end-to-end. Specifically:
- implement the missing backend controllers, services, repositories, and entity/db mappings
- complete the mobile navigation, screens, context, and API integration
- wire authentication, role-based access, ride booking, driver verification, SOS alerts, and payment flows
- ensure the backend and mobile app can communicate successfully using the existing API client
- preserve the current file/folder structure and the intended app design
- update documentation and SQL schema files as needed to match the working app

Do not invent a different architecture. Work within the existing Spring Boot + React Native structure and the current repository contents."