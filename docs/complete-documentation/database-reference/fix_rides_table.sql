-- Quick migration script to fix the rides table
-- Run this in MySQL if the schema updates don't apply automatically

USE campus_connect;

-- Drop the old table if needed and recreate with correct columns
DROP TABLE IF EXISTS rides;

CREATE TABLE rides (
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
