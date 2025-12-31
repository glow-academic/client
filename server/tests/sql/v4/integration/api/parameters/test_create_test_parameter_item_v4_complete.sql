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
    INSERT INTO parameter_items(parameter_id, name, description, value)
    VALUES (
        input_parameter_id,
        item_name,
        item_description,
        item_value
    )
    RETURNING id AS parameter_item_id, parameter_id, name, description, value, created_at, updated_at;
$$;

COMMIT;

