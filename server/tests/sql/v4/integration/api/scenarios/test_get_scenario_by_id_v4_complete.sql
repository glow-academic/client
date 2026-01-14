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
        s.id as scenario_id,
        (SELECT n.name FROM scenario_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1) as name,
        EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags_resource fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = TRUE) as active,
        s.created_at,
        s.updated_at
    FROM scenarios_resource s
    WHERE s.id = test_get_scenario_by_id_v4.input_scenario_id;
$$;