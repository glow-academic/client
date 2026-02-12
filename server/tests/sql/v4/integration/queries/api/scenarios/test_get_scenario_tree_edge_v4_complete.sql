-- Get scenario tree edge for test verification
-- Returns tree edge data for assertions
-- Now reads from scenarios_resource instead of scenario_tree_junction
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_scenario_tree_edge_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_scenario_tree_edge_v4(
    input_scenario_id uuid
)
RETURNS TABLE (
    parent_id uuid,
    child_id uuid,
    active boolean,
    created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        COALESCE(sr.parent_id, sr.id) as parent_id,
        sr.id as child_id,
        TRUE as active,
        sr.created_at
    FROM scenarios_resource sr
    WHERE sr.id = test_get_scenario_tree_edge_v4.input_scenario_id;
$$;
