-- Adds the approved column to users table
-- Safe to run; uses ALTER IGNORE to skip if column already exists

ALTER TABLE users
    ADD COLUMN approved TINYINT(1) DEFAULT 0;
