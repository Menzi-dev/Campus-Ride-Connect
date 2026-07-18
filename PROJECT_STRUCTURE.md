# CampusConnect Project Structure

## Overview
This document describes the actual current directory structure of the CampusConnect repository.

## Repository Root
- `AI_PROJECT_PROMPT.md` — Project prompt and analysis document.
- `CampusConnect.code-workspace` — VS Code workspace configuration.
- `PROJECT_STRUCTURE.md` — Project structure documentation.
- `pom.xml` — Root Maven project file.
- `backend/` — Spring Boot backend application.
- `database/` — Database SQL scripts and migration files.
- `docs/` — Documentation files.
- `mobile/` — React Native mobile application.

## Backend
- `backend/pom.xml` — Backend Maven dependencies, plugins, and build configuration.
- `backend/src/main/java/com/campusconnect/CampusConnectApplication.java` — Main Spring Boot application class.
- `backend/src/main/java/com/campusconnect/config/` — Configuration classes for security, WebSocket, CORS, and application settings.
- `backend/src/main/java/com/campusconnect/controller/` — REST controllers.
- `backend/src/main/java/com/campusconnect/dto/` — Data Transfer Object classes.
- `backend/src/main/java/com/campusconnect/entity/` — JPA entity classes.
- `backend/src/main/java/com/campusconnect/exception/` — Custom exception and error handling classes.
- `backend/src/main/java/com/campusconnect/mapper/` — Entity/DTO mapping classes.
- `backend/src/main/java/com/campusconnect/repository/` — Spring Data JPA repositories.
- `backend/src/main/java/com/campusconnect/security/` — Security classes, JWT handling, user details, and roles.
- `backend/src/main/java/com/campusconnect/service/` — Business service classes.
- `backend/src/main/java/com/campusconnect/util/` — Utility classes for encryption, file storage, geo helpers, and date handling.
- `backend/src/main/java/com/campusconnect/validation/` — Custom validation annotations and validators.
- `backend/src/main/java/com/campusconnect/websocket/` — WebSocket gateway and socket support.
- `backend/src/main/resources/application.yml` — Base Spring Boot configuration.
- `backend/src/main/resources/application-dev.yml` — Development profile configuration.
- `backend/src/main/resources/application-prod.yml` — Production profile configuration.
- `backend/src/main/resources/messages.properties` — Externalized validation and error messages.
- `backend/src/test/java/com/campusconnect/CampusConnectApplicationTests.java` — Backend application test scaffold.
- `backend/docker/Dockerfile` — Placeholder Dockerfile.
- `backend/docker/docker-compose.yml` — Placeholder Docker Compose file.
- `backend/effective-pom/` — Generated Maven effective POM output.
- `backend/target/` — Maven build output.

## Mobile Frontend
- `mobile/.env` — Environment variable placeholders for the mobile app.
- `mobile/.expo/` — Expo configuration and cache files.
- `mobile/App.tsx` — Root React Native entry point.
- `mobile/app.json` — Expo application configuration.
- `mobile/babel.config.js` — Babel configuration for Expo.
- `mobile/index.js` — Expo entry point.
- `mobile/package-lock.json` — Installed npm package versions.
- `mobile/package.json` — Mobile app dependencies and scripts.
- `mobile/tsconfig.json` — TypeScript compiler configuration.
- `mobile/node_modules/` — Installed npm dependencies.
- `mobile/src/assets/` — Static assets, images, and icon files.
- `mobile/src/components/` — Reusable UI components.
- `mobile/src/context/` — React context providers.
- `mobile/src/hooks/` — Custom hooks.
- `mobile/src/navigation/` — Navigation stack files.
- `mobile/src/screens/` — Screen components.
- `mobile/src/services/` — API client and service integration files.
- `mobile/src/theme/` — Theme and color definitions.
- `mobile/src/utils/` — Shared helper utilities and constants.

## Database
- `database/mysql/schema.sql` — Database schema placeholder.
- `database/mysql/seed.sql` — Seed data placeholder.
- `database/mysql/procedures.sql` — Stored procedures placeholder.
- `database/mysql/views.sql` — Database views placeholder.
- `database/mysql/migrations/001_init_schema.sql` — Initial migration placeholder.

## Documentation
- `docs/api-spec.md` — API specification documentation.
- `docs/architecture.md` — Architecture documentation.
- `docs/deployment.md` — Deployment documentation.
- `docs/requirements.md` — Requirements documentation.
- `docs/security.md` — Security documentation.
- `docs/testing.md` — Testing documentation.

## Notes
- The current repository includes backend Docker placeholders under `backend/docker/`, but no active root-level `docker/` deployment folder.
- Some files and folders are present as placeholders and may not contain full implementation content.
