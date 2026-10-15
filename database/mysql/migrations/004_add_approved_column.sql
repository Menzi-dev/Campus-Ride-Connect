-- Database migration: add approved column. Apply these schema/data changes to the intended database
-- after checking its current structure.
-- Adds the approved column to users table
-- Safe to run; uses ALTER IGNORE to skip if column already exists
-- Where: SQL statements in database/mysql/migrations/004_add_approved_column.sql, involving users.
-- How: MySQL executes these statements directly. CREATE/ALTER change structure;
-- INSERT/UPDATE/DELETE change rows when present. Java entities/repositories use the resulting
-- application tables.

ALTER TABLE users
    ADD COLUMN approved TINYINT(1) DEFAULT 0;
