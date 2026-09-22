CREATE DATABASE IF NOT EXISTS campus_connect;
USE campus_connect;

-- ---------------------------------------------------------------------
-- USERS  (matches entity/User.java)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    full_name           VARCHAR(255) NULL,
    email               VARCHAR(255) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    role                ENUM('RIDER', 'DRIVER', 'ADMIN', 'SECURITY') NOT NULL,
    face_verified       TINYINT(1) DEFAULT 0,
    face_embedding      LONGTEXT NULL,
    year_of_study       INT NULL,
    emergency_contact   VARCHAR(255) NULL,
    status              ENUM('ACTIVE', 'PENDING', 'SUSPENDED') DEFAULT 'PENDING',
    created_at          TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    licence_plate       VARCHAR(255) NULL,
    phone               VARCHAR(255) NULL,
    student_number      VARCHAR(255) NULL,
    vehicle_make        VARCHAR(255) NULL,
    vehicle_year        INT NULL
);

-- ---------------------------------------------------------------------
-- RIDES  (matches entity/Ride.java — subset of the full ERD needed for
-- the Home / Book Ride screen; driver matching, payments, ratings,
-- SOS_Alerts, FaceVerifications, Documents follow in later phases)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rides (
    id                      BIGINT AUTO_INCREMENT PRIMARY KEY,
    rider_id                BIGINT NOT NULL,
    driver_id               BIGINT NULL,
    pickup_location         VARCHAR(200),
    pickup_address          VARCHAR(255),
    destination             VARCHAR(200),
    destination_address     VARCHAR(255),
    pickup_lat              DECIMAL(10,7),
    pickup_lng              DECIMAL(10,7),
    dest_lat                DECIMAL(10,7),
    dest_lng                DECIMAL(10,7),
    fare                    DECIMAL(6,2),
    distance_km             DECIMAL(5,2),
    duration_minutes        DOUBLE,
    status                  ENUM('PENDING', 'ACCEPTED', 'ENROUTE', 'ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING',
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_rides_rider FOREIGN KEY (rider_id) REFERENCES users(user_id),
    CONSTRAINT fk_rides_driver FOREIGN KEY (driver_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS sos_alerts (
    alert_id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    ride_id             BIGINT NOT NULL,
    triggered_by        BIGINT NOT NULL,
    gps_lat             DECIMAL(10,7) NULL,
    gps_lng             DECIMAL(10,7) NULL,
    audio_file_path     VARCHAR(500) NULL,
    recording_duration  INT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'DISPATCHED',
    resolved_at         DATETIME NULL,
    resolved_by         BIGINT NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX sos_alerts_ride_id (ride_id),
    INDEX sos_alerts_triggered_by (triggered_by),
    CONSTRAINT sos_alerts_ride_fk FOREIGN KEY (ride_id) REFERENCES rides (id) ON DELETE CASCADE,
    CONSTRAINT sos_alerts_user_fk FOREIGN KEY (triggered_by) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT sos_alerts_resolved_by_fk FOREIGN KEY (resolved_by) REFERENCES users (user_id) ON DELETE SET NULL
);

-- No seed users here on purpose: BCrypt hashes are salted per-generation, so
-- a hand-typed one won't actually match any password. Create your first test
-- account for real through the app's Create Account screen (it calls
-- /api/auth/register, which hashes the password correctly), then log in.