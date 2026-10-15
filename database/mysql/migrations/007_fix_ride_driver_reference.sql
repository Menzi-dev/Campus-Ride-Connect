-- Database migration: fix ride driver reference. Apply these schema/data changes to the intended
-- database after checking its current structure.
-- Where: SQL statements in database/mysql/migrations/007_fix_ride_driver_reference.sql, involving
-- rides.
-- How: MySQL executes these statements directly. CREATE/ALTER change structure;
-- INSERT/UPDATE/DELETE change rows when present. Java entities/repositories use the resulting
-- application tables.
USE campus_connect;

-- Ride.driverId stores the authenticated users.user_id throughout the application.
ALTER TABLE rides
    DROP FOREIGN KEY rides_ibfk_2;

ALTER TABLE rides
    ADD CONSTRAINT fk_rides_driver_user
    FOREIGN KEY (driver_id) REFERENCES users(user_id);
