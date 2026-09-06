USE campus_connect;

-- Ride.driverId stores the authenticated users.user_id throughout the application.
ALTER TABLE rides
    DROP FOREIGN KEY rides_ibfk_2;

ALTER TABLE rides
    ADD CONSTRAINT fk_rides_driver_user
    FOREIGN KEY (driver_id) REFERENCES users(user_id);
