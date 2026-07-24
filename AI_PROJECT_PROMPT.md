# CampusConnect – Current Project Prompt for AI

## 1. Project Overview
CampusConnect is a full-stack student ride-sharing and campus safety application. The current repository contains:
- a Spring Boot 3.5 backend in Java 25
- a React Native / Expo mobile frontend in TypeScript
- a MySQL database connection configured for local development
- documentation and SQL placeholders for the wider product

The app is currently being used to validate the backend-to-mobile connection flow, including a live users endpoint from the database.

## 2. Current Repository Structure
Root folders and files:
- [AI_PROJECT_PROMPT.md](AI_PROJECT_PROMPT.md) – this project prompt file
- [CampusConnect.code-workspace](CampusConnect.code-workspace) – VS Code workspace file
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) – current project structure summary
- [pom.xml](pom.xml) – root Maven project file
- [backend/](backend/) – Spring Boot backend application
- [database/](database/) – SQL scripts and migration files
- [docs/](docs/) – product and technical documentation
- [mobile/](mobile/) – React Native mobile application
- [.gitignore](.gitignore) – repository ignore rules for build output and dependencies

## 3. Backend Status
The backend is located in [backend/](backend/).

### Main backend entry point
- [backend/src/main/java/com/campusconnect/CampusConnectApplication.java](backend/src/main/java/com/campusconnect/CampusConnectApplication.java)
  # CampusConnect – Current Project Prompt for AI

  This file documents the current repository layout, recent fixes applied during the current session, and an actionable brief you can pass to another AI or developer.

  1) High-level summary
   - Full-stack student ride-sharing and campus safety application.
   - Backend: Spring Boot (parent 3.5.0), Java 25.
   - Mobile: React Native + Expo (TypeScript).
   - Database: MySQL scripts in `database/mysql/` (migrations, schema, seed).

  2) What changed in this session (short)
   - Restored missing backend auth support classes: `User` entity, `UserRepository`, DTOs (`RegisterRequest`, `AuthRequest`, `AuthResponse`) and `JwtTokenProvider` implementation.
   - Compiled the backend successfully with `mvn -DskipTests compile`.
   - Mobile navigation typing and landing-route fixes were applied earlier in the session (screens use typed navigation and `Landing` is initial route).

  3) Key repo locations (inspect these exact paths)
   - Root: `pom.xml`, `PROJECT_STRUCTURE.md`, `PROJECT_OVERVIEW.md`, `AI_PROJECT_PROMPT.md`
   - Backend: `backend/` — see `backend/src/main/java/com/campusconnect/` for controllers, services, security and entities.
     - Important files touched or relevant:
       - `backend/src/main/java/com/campusconnect/service/AuthService.java`
       - `backend/src/main/java/com/campusconnect/controller/AuthController.java`
       - `backend/src/main/java/com/campusconnect/entity/User.java`
       - `backend/src/main/java/com/campusconnect/repository/UserRepository.java`
       - `backend/src/main/java/com/campusconnect/dto/RegisterRequest.java`
       - `backend/src/main/java/com/campusconnect/dto/AuthRequest.java`
       - `backend/src/main/java/com/campusconnect/dto/AuthResponse.java`
       - `backend/src/main/java/com/campusconnect/security/JwtTokenProvider.java`
       - `backend/src/main/java/com/campusconnect/config/SecurityConfig.java`
   - Mobile: `mobile/` — entry point `mobile/App.tsx`, navigation in `mobile/src/navigation/`, screens in `mobile/src/screens/`, services in `mobile/src/services/`.

  4) How to verify locally (commands)
   - Backend compile:
  ```
  cd backend
  mvn -DskipTests compile
  ```
   - Run backend (dev profile):
  ```
  cd backend
  mvn -Dspring-boot.run.profiles=dev spring-boot:run
  ```
   - Mobile checks and web preview:
  ```
  cd mobile
  npx tsc --noEmit
  npx expo start --web
  ```

  5) Example API tests (curl)
   - Register:
  ```
  curl -X POST http://localhost:8080/api/auth/register -H "Content-Type: application/json" -d '{"fullName":"Test User","email":"test@example.com","password":"pass123","role":"STUDENT"}'
  ```
   - Login:
  ```
  curl -X POST http://localhost:8080/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"pass123"}'
  ```
   - Expected login response: JSON with `token` (JWT string) and `user` object containing `id`, `email`, `fullName`, etc.

  6) Short risk notes
   - Database schema in `database/mysql/` is still partial; running auth or user endpoints against an empty DB will fail until the `users` table exists.
   - Environment properties `app.jwt.secret` and `app.jwt.expiration-ms` should be set in `application-dev.yml` or environment for production-like runs.

  7) If you call another AI with this project
   - Share this repo root and ask for small, safe patches only (add DTOs/entities, implement token generation, wire missing services). Provide exact file paths to edit.

  8) Next step recommendation
   - Run the backend and exercise `/api/auth/register` and `/api/auth/login`. If the DB is empty, create a `users` table (quick SQL or using JPA/Hibernate DDL-auto for dev) and re-run.

  If you want, I can also generate unified patch diffs for the backend files I added/updated so you can paste them into another AI or apply them directly.