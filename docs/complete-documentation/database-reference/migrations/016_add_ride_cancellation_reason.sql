ALTER TABLE rides
    ADD COLUMN cancellation_reason VARCHAR(500) NULL,
    ADD COLUMN cancelled_by BIGINT NULL;