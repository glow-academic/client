-- Get key by ID for test verification
-- Returns key details for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_key_by_id_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_key_by_id_v4(
    input_key_id uuid
)
RETURNS TABLE (
    key_id uuid,
    name text,
    key text,
    description text,
    active boolean,
    created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        kr.id AS key_id,
        kr.name,
        kr.key,
        kr.description,
        kr.active,
        kr.created_at
    FROM keys_resource kr
    WHERE kr.id = input_key_id;
$$;
