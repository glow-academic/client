-- Get key department links for test verification
-- Returns all active links for a key

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_key_department_links_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_key_department_links_v4(
    input_key_id uuid
)
RETURNS TABLE (
    key_id uuid,
    department_id uuid,
    active boolean,
    created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        key_id,
        department_id,
        active,
        created_at
    FROM key_departments
    WHERE key_id = input_key_id
      AND active = true;
$$;

COMMIT;

