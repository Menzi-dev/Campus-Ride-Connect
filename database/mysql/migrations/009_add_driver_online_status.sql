-- Database migration: add driver online status. Apply these schema/data changes to the intended
-- database after checking its current structure.
-- Where: SQL statements in database/mysql/migrations/009_add_driver_online_status.sql, involving
-- drivers.
-- How: MySQL executes these statements directly. CREATE/ALTER change structure;
-- INSERT/UPDATE/DELETE change rows when present. Java entities/repositories use the resulting
-- application tables.
USE campus_connect;

ALTER TABLE drivers
    ADD COLUMN online BOOLEAN NOT NULL DEFAULT FALSE;
