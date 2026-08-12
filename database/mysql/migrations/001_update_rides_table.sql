-- Migration: Update rides table with new columns and status values
-- This migration adds the missing columns and updates the status enum to support new ride statuses

-- Add missing columns to rides table if they don't exist
ALTER TABLE rides
ADD COLUMN IF NOT EXISTS pickup_address VARCHAR(255) AFTER pickup_location,
ADD COLUMN IF NOT EXISTS destination_address VARCHAR(255) AFTER destination,
ADD COLUMN IF NOT EXISTS duration_minutes DECIMAL(5,2) AFTER distance_km,
ADD COLUMN IF NOT EXISTS updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- Update the status enum to include new statuses (ACCEPTED, ENROUTE, ARRIVED, STARTED)
ALTER TABLE rides 
MODIFY COLUMN status ENUM('PENDING', 'ACCEPTED', 'ENROUTE', 'ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING';

-- Add indexes for better performance
ALTER TABLE rides
ADD INDEX IF NOT EXISTS idx_rides_rider (rider_id),
ADD INDEX IF NOT EXISTS idx_rides_driver (driver_id),
ADD INDEX IF NOT EXISTS idx_rides_status (status),
ADD INDEX IF NOT EXISTS idx_rides_created (created_at);

-- Verify the table structure
SHOW COLUMNS FROM rides;

