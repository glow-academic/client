-- Create scenario tree edge for test setup
-- Returns edge data for verification

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_scenario_tree_edge_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_create_scenario_tree_edge_v4(
    input_scenario_id uuid
)
RETURNS TABLE (
    parent_id uuid,
    child_id uuid,
    active boolean,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO scenario_tree(parent_id, child_id, active)
    VALUES (
        test_create_scenario_tree_edge_v4.input_scenario_id,
        test_create_scenario_tree_edge_v4.input_scenario_id,
        true
    )
    RETURNING parent_id, child_id, active, created_at;
$$;

COMMIT;

