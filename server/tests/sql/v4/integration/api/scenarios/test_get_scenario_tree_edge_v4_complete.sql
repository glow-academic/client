-- Get scenario tree edge for test verification
-- Returns tree edge data for assertions

BEGIN;

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
        parent_id,
        child_id,
        active,
        created_at
    FROM scenario_tree
    WHERE parent_id = test_get_scenario_tree_edge_v4.input_scenario_id
      AND child_id = test_get_scenario_tree_edge_v4.input_scenario_id;
$$;

COMMIT;

