-- Get scenario by ID for test verification
-- Returns scenario data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_scenario_by_id_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_scenario_by_id_v4(
    input_scenario_id uuid
)
RETURNS TABLE (
    scenario_id uuid,
    name text,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        id as scenario_id,
        name,
        active,
        created_at,
        updated_at
    FROM scenarios
    WHERE id = test_get_scenario_by_id_v4.input_scenario_id;
$$;