-- Get or create a test scenario for test setup
-- Returns scenario_id for use in tests

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_or_create_scenario_v4();

-- Create function
CREATE OR REPLACE FUNCTION test_get_or_create_scenario_v4()
RETURNS TABLE (
    scenario_id uuid,
    name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_scenario_id uuid;
BEGIN
    -- Try to get existing scenario
    SELECT id INTO v_scenario_id
    FROM scenarios
    LIMIT 1;

    -- If no scenario exists, create one
    IF v_scenario_id IS NULL THEN
        INSERT INTO scenarios(name, active)
        VALUES ('Test Scenario', true)
        RETURNING id INTO v_scenario_id;

        -- Insert self-referencing tree edge
        INSERT INTO scenario_tree(parent_id, child_id, active)
        VALUES (v_scenario_id, v_scenario_id, true);
    END IF;

    -- Return result
    RETURN QUERY
    SELECT 
        s.id as scenario_id,
        s.name
    FROM scenarios s
    WHERE s.id = v_scenario_id;
END;
$$;

COMMIT;

