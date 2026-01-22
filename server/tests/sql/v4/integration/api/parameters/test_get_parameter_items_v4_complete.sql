-- Get parameter items for test verification
-- Returns items ordered by name
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
    -- NOTE: parameter_items table does not exist in current schema
    -- Parameters don't have items in the current schema
    -- This function returns empty result - tests_entry using this may need updating
    SELECT NULL::uuid AS parameter_item_id, NULL::uuid AS parameter_id, NULL::text AS name, NULL::text AS description, NULL::text AS value, NULL::timestamptz AS created_at, NULL::timestamptz AS updated_at WHERE false;
$$;