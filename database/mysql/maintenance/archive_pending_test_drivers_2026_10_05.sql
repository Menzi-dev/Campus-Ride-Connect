-- Confirmed fixtures from AdminControllerPendingDriversTest and
-- AdminControllerWithAuthenticationTest, inspected on 2026-10-05.
-- Archive only these pending, unused fixtures; retain account records.
USE campus_connect;
START TRANSACTION;
CREATE TEMPORARY TABLE confirmed_pending_test_drivers AS
SELECT d.driver_id, u.user_id
FROM drivers d JOIN users u ON u.user_id = d.user_id
WHERE (d.driver_id, u.user_id) IN
  ((47,82),(48,83),(49,84),(50,85),(51,87),(52,89),(53,91),(54,92))
  AND d.approval_status = 'PENDING' AND u.status = 'PENDING'
  AND u.role = 'DRIVER'
  AND (
    (u.full_name = 'Test Driver Approval' AND u.email REGEXP '^testdriver_[0-9]{13}@spu[.]ac[.]za$')
    OR (u.full_name = 'Test Driver Auth' AND u.email REGEXP '^testdriver_auth_[0-9]{13}@spu[.]ac[.]za$')
    OR (u.full_name = 'Non-Admin Driver' AND u.email REGEXP '^driver_nonadmin_[0-9]{13}@spu[.]ac[.]za$')
  )
  AND NOT EXISTS (SELECT 1 FROM rides r WHERE r.driver_id = d.driver_id OR r.rider_id = u.user_id);
SELECT COUNT(*) AS confirmed_test_applications FROM confirmed_pending_test_drivers;
UPDATE drivers d JOIN confirmed_pending_test_drivers t ON t.driver_id = d.driver_id
SET d.approval_status = 'REJECTED', d.online = FALSE;
UPDATE users u JOIN confirmed_pending_test_drivers t ON t.user_id = u.user_id
SET u.status = 'SUSPENDED';
COMMIT;
DROP TEMPORARY TABLE confirmed_pending_test_drivers;
SELECT COUNT(*) AS remaining_pending_applications FROM drivers WHERE approval_status = 'PENDING';
