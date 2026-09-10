CREATE TABLE IF NOT EXISTS messages (
    message_id BIGINT NOT NULL AUTO_INCREMENT,
    ride_id BIGINT NOT NULL,
    sender_id BIGINT NOT NULL,
    message_text VARCHAR(1000) NOT NULL,
    sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (message_id),
    KEY messages_ride_id (ride_id),
    KEY messages_sender_id (sender_id),
    CONSTRAINT messages_fk_ride FOREIGN KEY (ride_id) REFERENCES rides (ride_id) ON DELETE CASCADE,
    CONSTRAINT messages_fk_sender FOREIGN KEY (sender_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;