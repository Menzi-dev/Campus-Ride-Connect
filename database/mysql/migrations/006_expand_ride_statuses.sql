-- Database migration: expand ride statuses. Apply these schema/data changes to the intended
-- database after checking its current structure.
-- Where: SQL statements in database/mysql/migrations/006_expand_ride_statuses.sql, involving rides.
-- How: MySQL executes these statements directly. CREATE/ALTER change structure;
-- INSERT/UPDATE/DELETE change rows when present. Java entities/repositories use the resulting
-- application tables.
USE campus_connect;

-- Keep existing rides while aligning the live schema with Ride.RideStatus.
ALTER TABLE rides
    MODIFY COLUMN status ENUM('PENDING', 'ACTIVE', 'ACCEPTED', 'ENROUTE', 'ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED')
    DEFAULT 'PENDING';

-- ACTIVE was the legacy name used by the original schema.
UPDATE rides
SET status = 'ACCEPTED'
WHERE status = 'ACTIVE';
