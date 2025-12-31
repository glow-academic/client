-- Get parameter item department links for test verification
-- Returns all active links for an item

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_parameter_item_department_links_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_parameter_item_department_links_v4(
    input_parameter_item_id uuid
)
RETURNS TABLE (
    parameter_item_id uuid,
    department_id uuid,
    active boolean,
    created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        parameter_item_id,
        department_id,
        active,
        created_at
    FROM parameter_item_departments
    WHERE parameter_item_id = input_parameter_item_id
      AND active = true;
$$;

COMMIT;

