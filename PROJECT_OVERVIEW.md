# CampusConnect Project Overview (updated)

CampusConnect is a full-stack campus transportation and safety application for students, drivers, and administrators. This document summarizes the current project state after recent development work in this session.

Overview
 - Backend: Spring Boot (3.5.0), Java 25. Main app under `backend/src/main/java/com/campusconnect/`.
 - Mobile: React Native + Expo (TypeScript) under `mobile/`.
 - Database: MySQL scripts in `database/mysql/` (migrations, schema, seed files).

Notable recent changes
 - Restored and implemented backend auth model support:
   - `backend/src/main/java/com/campusconnect/entity/User.java` (entity)
   - `backend/src/main/java/com/campusconnect/repository/UserRepository.java`
   - DTOs: `backend/src/main/java/com/campusconnect/dto/RegisterRequest.java`, `AuthRequest.java`, `AuthResponse.java`
   - `backend/src/main/java/com/campusconnect/security/JwtTokenProvider.java` implemented for basic JWT generation (jjwt)
 - Backend compiled successfully after fixes: `mvn -DskipTests compile`.
 - Mobile navigation typing fixes applied earlier (typed `useNavigation` and `Landing` as initial route). TypeScript checks passed after those fixes.

Project structure (high level)
 - `backend/` — Spring Boot service (controllers, services, entities, repositories, security)
 - `mobile/` — React Native + Expo app (navigation, screens, services, context)
 - `database/mysql/` — SQL schema, migrations and seed data
 - `docs/` — API and architecture docs

How to run (short)
 - Backend compile:
```
cd backend
mvn -DskipTests compile
```
 - Run backend (dev):
```
cd backend
mvn -Dspring-boot.run.profiles=dev spring-boot:run
```
 - Mobile checks and preview:
```
cd mobile
npx tsc --noEmit
npx expo start --web
```

Key files to inspect
 - `backend/src/main/java/com/campusconnect/service/AuthService.java`
 - `backend/src/main/java/com/campusconnect/controller/AuthController.java`
 - `backend/src/main/java/com/campusconnect/security/JwtTokenProvider.java`
 - `backend/src/main/java/com/campusconnect/entity/User.java`
 - `mobile/App.tsx` and `mobile/src/navigation/` for route configuration

Empty-file audit (updated)
 - Many previously empty placeholder files remain in the repo. During this session I implemented the essential auth files listed above; remaining placeholders still need implementation (controllers, services, some entities and utilities).

Risks / next actions
 - Database schema: `database/mysql/` still contains placeholders; create `users` table or enable Hibernate DDL-auto for development to persist users.
 - Environment variables: set `app.jwt.secret` and `app.jwt.expiration-ms` in `backend/src/main/resources/application-dev.yml` or OS environment before running in production mode.

If you want, I can produce unified patch diffs for the backend files I added/updated and update the remaining documentation or SQL schema next.
