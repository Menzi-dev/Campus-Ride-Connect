-- Approval example: add the pending driver data defined below for local approval workflow checks.
-- Test data: Add a pending driver for approval testing
-- Where: SQL statements in database/mysql/004_add_pending_driver_for_approval.sql, involving users,
-- status and drivers.
-- How: MySQL executes these statements directly. CREATE/ALTER change structure;
-- INSERT/UPDATE/DELETE change rows when present. Java entities/repositories use the resulting
-- application tables.
INSERT INTO users (full_name, email, password_hash, role, status, phone, student_number, year_of_study, created_at)
VALUES (
  'Thabo Mkhize',
  'thabo.mkhize@spu.ac.za',
  '$2a$10$abc123xyz789...',
  'DRIVER',
  'PENDING',
  '0712345678',
  '20240101',
  2,
  NOW()
)
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Get the last inserted user ID and create driver record
INSERT INTO drivers (user_id, licence_plate, vehicle_make, vehicle_year, approval_status, rating, total_trips)
SELECT LAST_INSERT_ID(), 'ABC123GP', 'Toyota', 2023, 'PENDING', 0, 0
WHERE EXISTS (
  SELECT 1 FROM users WHERE email = 'thabo.mkhize@spu.ac.za'
);
