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
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        kr.id AS key_id,
        (SELECT n.name FROM key_names kn JOIN names_resource n ON kn.name_id = n.id WHERE kn.key_id = kr.id LIMIT 1) AS name,
        kr.key,
        (SELECT d.description FROM key_descriptions kd JOIN descriptions_resource d ON kd.description_id = d.id WHERE kd.key_id = kr.id LIMIT 1) AS description,
        EXISTS (SELECT 1 FROM key_flags kf JOIN flags_resource fl ON kf.flag_id = fl.id WHERE kf.key_id = kr.id AND fl.name = 'active'  AND kf.value = TRUE) AS active,
        kr.created_at,
        kr.updated_at
    FROM keys_resource kr
    WHERE kr.id = input_key_id;
$$;