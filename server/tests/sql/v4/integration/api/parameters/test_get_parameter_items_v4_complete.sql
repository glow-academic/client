-- Get parameter items for test verification
-- Returns items ordered by name

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_parameter_items_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_parameter_items_v4(
    input_parameter_id uuid
)
RETURNS TABLE (
    parameter_item_id uuid,
    parameter_id uuid,
    name text,
    description text,
    value text,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        id AS parameter_item_id,
        parameter_id,
        name,
        description,
        value,
        created_at,
        updated_at
    FROM parameter_items
    WHERE parameter_id = input_parameter_id
    ORDER BY name;
$$;

COMMIT;

