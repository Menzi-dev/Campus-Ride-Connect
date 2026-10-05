-- Restoration record: all eight accounts were PENDING and offline before archiving.
-- Run only if these confirmed test fixtures need to return to the approvals queue.
USE campus_connect;
START TRANSACTION;
UPDATE drivers SET approval_status = 'PENDING', online = FALSE
WHERE (driver_id,user_id) IN
  ((47,82),(48,83),(49,84),(50,85),(51,87),(52,89),(53,91),(54,92))
  AND approval_status = 'REJECTED';
UPDATE users SET status = 'PENDING'
WHERE user_id IN (82,83,84,85,87,89,91,92) AND status = 'SUSPENDED';
COMMIT;
