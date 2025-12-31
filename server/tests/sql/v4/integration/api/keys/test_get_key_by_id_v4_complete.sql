-- Get key by ID for test verification
-- Returns key details for assertions

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_key_by_id_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_key_by_id_v4(
    input_key_id uuid
)
RETURNS TABLE (
    key_id uuid,
    name text,
    type text,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        id AS key_id,
        name,
        type,
        active,
        created_at,
        updated_at
    FROM keys
    WHERE id = input_key_id;
$$;

COMMIT;

