USE campus_connect;

-- Keep existing rides while aligning the live schema with Ride.RideStatus.
ALTER TABLE rides
    MODIFY COLUMN status ENUM('PENDING', 'ACTIVE', 'ACCEPTED', 'ENROUTE', 'ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED')
    DEFAULT 'PENDING';

-- ACTIVE was the legacy name used by the original schema.
UPDATE rides
SET status = 'ACCEPTED'
WHERE status = 'ACTIVE';
