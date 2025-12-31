-- Get first parameter item for test setup
-- Returns parameter item ID for linking

BEGIN;

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
    SELECT id AS parameter_item_id
    FROM parameter_items
    LIMIT 1;
$$;

COMMIT;

