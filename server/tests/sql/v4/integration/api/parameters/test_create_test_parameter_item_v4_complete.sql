-- Create a test parameter item for test setup
-- Returns item data for assertions

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_parameter_item_v4(uuid, text, text, text);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_parameter_item_v4(
    input_parameter_id uuid,
    item_name text,
    item_description text,
    item_value text
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
VOLATILE
AS $$
    -- NOTE: parameter_items table does not exist in current schema
    -- Parameters don't have items in the current schema
    -- This function returns empty result - tests using this may need updating
    SELECT NULL::uuid AS parameter_item_id, NULL::uuid AS parameter_id, NULL::text AS name, NULL::text AS description, NULL::text AS value, NULL::timestamptz AS created_at, NULL::timestamptz AS updated_at WHERE false;
$$;

COMMIT;

