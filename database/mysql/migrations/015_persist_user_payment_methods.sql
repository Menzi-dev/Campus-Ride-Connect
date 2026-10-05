ALTER TABLE users
    ADD COLUMN default_payment_method VARCHAR(20) NOT NULL DEFAULT 'CASH';

CREATE TABLE user_payment_methods (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT NOT NULL,
    label           VARCHAR(80) NOT NULL,
    last_four       CHAR(4) NOT NULL,
    brand           VARCHAR(32) NOT NULL,
    expiry          CHAR(5) NOT NULL,
    cardholder      VARCHAR(120) NOT NULL,
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX user_payment_methods_user_id (user_id),
    CONSTRAINT user_payment_methods_user_fk FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);