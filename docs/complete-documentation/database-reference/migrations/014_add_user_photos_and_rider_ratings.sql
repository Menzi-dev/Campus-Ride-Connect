ALTER TABLE users
    ADD COLUMN profile_photo LONGTEXT NULL;

ALTER TABLE rides
    ADD COLUMN driver_rating INT NULL,
    ADD COLUMN driver_rating_comment VARCHAR(500) NULL;