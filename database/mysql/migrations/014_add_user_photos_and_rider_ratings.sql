-- Database migration: add user photos and rider ratings. Apply these schema/data changes to the
-- intended database after checking its current structure.
-- Where: SQL statements in database/mysql/migrations/014_add_user_photos_and_rider_ratings.sql,
-- involving users and rides.
-- How: MySQL executes these statements directly. CREATE/ALTER change structure;
-- INSERT/UPDATE/DELETE change rows when present. Java entities/repositories use the resulting
-- application tables.
ALTER TABLE users
    ADD COLUMN profile_photo LONGTEXT NULL;

ALTER TABLE rides
    ADD COLUMN driver_rating INT NULL,
    ADD COLUMN driver_rating_comment VARCHAR(500) NULL;