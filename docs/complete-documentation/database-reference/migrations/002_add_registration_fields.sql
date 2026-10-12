-- Adds the extra fields collected by the new Create Account screen.
-- Safe to run on an existing database; does not touch existing data.

ALTER TABLE users
    ADD COLUMN student_number VARCHAR(50)  NULL AFTER full_name,
    ADD COLUMN phone          VARCHAR(30)  NULL AFTER student_number,
    ADD COLUMN licence_plate  VARCHAR(20)  NULL AFTER emergency_contact,
    ADD COLUMN vehicle_make   VARCHAR(50)  NULL AFTER licence_plate,
    ADD COLUMN vehicle_year   SMALLINT     NULL AFTER vehicle_make;