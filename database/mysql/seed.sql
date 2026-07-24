-- Test User Seed Data
-- This creates a test user for development/testing

USE campus_connect;

-- Insert a test user (RIDER)
-- Email: Menzi@spu.ac.za
-- Password: password123
-- BCrypt hash: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36LRW6Ye
INSERT INTO users (full_name, email, password_hash, role, status, created_at)
VALUES (
    'Menzi Test User',
    'Menzi@spu.ac.za',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36LRW6Ye',
    'RIDER',
    'ACTIVE',
    CURRENT_TIMESTAMP
);

-- Insert another test user (DRIVER)
-- Email: driver@test.com
-- Password: password123
INSERT INTO users (full_name, email, password_hash, role, status, created_at)
VALUES (
    'Driver Test User',
    'driver@test.com',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36LRW6Ye',
    'DRIVER',
    'ACTIVE',
    CURRENT_TIMESTAMP
);
