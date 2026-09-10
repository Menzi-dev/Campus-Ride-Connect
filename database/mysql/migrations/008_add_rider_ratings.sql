USE campus_connect;

ALTER TABLE rides
    ADD COLUMN rider_rating INT NULL,
    ADD COLUMN rider_rating_comment VARCHAR(500) NULL;
