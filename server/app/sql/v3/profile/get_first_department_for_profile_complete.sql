-- Get first department for profile
-- Converted to PostgreSQL function
-- Uses safe drop/recreate pattern

BEGIN;

-- 1) Drop function first
DROP FUNCTION IF EXISTS socket_get_first_department_for_profile_v3(uuid);

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_get_first_department_for_profile_v3(
    profile_id uuid
)
RETURNS TABLE (
    department_id uuid
)
LANGUAGE sql
STABLE
AS $$
SELECT department_id
FROM profile_departments
WHERE profile_id = profile_id
  AND active = true
LIMIT 1
$$;

COMMIT;

