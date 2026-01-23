-- Get first parameter item for test setup
-- Returns parameter item ID for linking
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_first_parameter_item_v4();

-- Create function
CREATE OR REPLACE FUNCTION test_get_first_parameter_item_v4()
RETURNS TABLE (
    parameter_item_id uuid
)
LANGUAGE sql
STABLE
AS $$
    -- NOTE: parameter_items table does not exist in current schema
    -- This function returns empty result - tests_entry using this may need updating
    SELECT NULL::uuid AS parameter_item_id WHERE false;
$$;