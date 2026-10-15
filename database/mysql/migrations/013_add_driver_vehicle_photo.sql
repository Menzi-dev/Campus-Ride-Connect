-- Database migration: add driver vehicle photo. Apply these schema/data changes to the intended
-- database after checking its current structure.
-- Where: SQL statements in database/mysql/migrations/013_add_driver_vehicle_photo.sql, involving
-- drivers.
-- How: MySQL executes these statements directly. CREATE/ALTER change structure;
-- INSERT/UPDATE/DELETE change rows when present. Java entities/repositories use the resulting
-- application tables.
ALTER TABLE drivers
    ADD COLUMN vehicle_photo LONGTEXT NULL;