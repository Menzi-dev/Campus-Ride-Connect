-- Database migration: add rider ratings. Apply these schema/data changes to the intended database
-- after checking its current structure.
-- Where: SQL statements in database/mysql/migrations/008_add_rider_ratings.sql, involving rides.
-- How: MySQL executes these statements directly. CREATE/ALTER change structure;
-- INSERT/UPDATE/DELETE change rows when present. Java entities/repositories use the resulting
-- application tables.
USE campus_connect;

ALTER TABLE rides
    ADD COLUMN rider_rating INT NULL,
    ADD COLUMN rider_rating_comment VARCHAR(500) NULL;
