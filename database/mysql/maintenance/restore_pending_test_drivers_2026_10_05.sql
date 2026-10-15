-- Test-data maintenance: restore pending test drivers 2026 10 05. This script changes the
-- specifically selected test records below.
-- Restoration record: all eight accounts were PENDING and offline before archiving.
-- Run only if these confirmed test fixtures need to return to the approvals queue.
-- Where: SQL statements in database/mysql/maintenance/restore_pending_test_drivers_2026_10_05.sql,
-- involving drivers and users.
-- How: MySQL executes these statements directly. CREATE/ALTER change structure;
-- INSERT/UPDATE/DELETE change rows when present. Java entities/repositories use the resulting
-- application tables.
USE campus_connect;
START TRANSACTION;
UPDATE drivers SET approval_status = 'PENDING', online = FALSE
WHERE (driver_id,user_id) IN
  ((47,82),(48,83),(49,84),(50,85),(51,87),(52,89),(53,91),(54,92))
  AND approval_status = 'REJECTED';
UPDATE users SET status = 'PENDING'
WHERE user_id IN (82,83,84,85,87,89,91,92) AND status = 'SUSPENDED';
COMMIT;
