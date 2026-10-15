-- Database migration: update rides table add columns. Apply these schema/data changes to the
-- intended database after checking its current structure.
-- Add missing columns to rides table for entity mapping
-- This migration adds columns that are expected by the Ride entity
-- Where: SQL statements in database/mysql/migrations/005_update_rides_table_add_columns.sql,
-- involving rides and CURRENT_TIMESTAMP.
-- How: MySQL executes these statements directly. CREATE/ALTER change structure;
-- INSERT/UPDATE/DELETE change rows when present. Java entities/repositories use the resulting
-- application tables.

USE campus_connect;

-- Check if columns exist and add them if they don't
ALTER TABLE rides
ADD COLUMN IF NOT EXISTS pickup_address VARCHAR(255) AFTER pickup_location,
ADD COLUMN IF NOT EXISTS destination_address VARCHAR(255) AFTER destination,
ADD COLUMN IF NOT EXISTS duration_minutes DOUBLE AFTER distance_km,
ADD COLUMN IF NOT EXISTS updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Update the status enum to include all supported statuses
ALTER TABLE rides 
MODIFY COLUMN status ENUM('PENDING', 'ACCEPTED', 'ENROUTE', 'ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING';

-- Add foreign key for driver_id if it doesn't exist
ALTER TABLE rides 
ADD CONSTRAINT fk_rides_driver FOREIGN KEY IF NOT EXISTS (driver_id) REFERENCES users(user_id);
