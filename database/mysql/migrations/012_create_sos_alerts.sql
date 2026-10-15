-- Database migration: create sos alerts. Apply these schema/data changes to the intended database
-- after checking its current structure.
-- Where: SQL statements in database/mysql/migrations/012_create_sos_alerts.sql, involving
-- sos_alerts.
-- How: MySQL executes these statements directly. CREATE/ALTER change structure;
-- INSERT/UPDATE/DELETE change rows when present. Java entities/repositories use the resulting
-- application tables.
CREATE TABLE IF NOT EXISTS sos_alerts (
    alert_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ride_id BIGINT NOT NULL,
    triggered_by BIGINT NOT NULL,
    gps_lat DECIMAL(10,7) NULL,
    gps_lng DECIMAL(10,7) NULL,
    audio_file_path VARCHAR(500) NULL,
    recording_duration INT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DISPATCHED',
    resolved_at DATETIME NULL,
    resolved_by BIGINT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX sos_alerts_ride_id (ride_id),
    INDEX sos_alerts_triggered_by (triggered_by),
    CONSTRAINT sos_alerts_ride_fk FOREIGN KEY (ride_id) REFERENCES rides (ride_id) ON DELETE CASCADE,
    CONSTRAINT sos_alerts_user_fk FOREIGN KEY (triggered_by) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT sos_alerts_resolved_by_fk FOREIGN KEY (resolved_by) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
