-- Create scenario tree edge for test setup
-- Returns edge data for verification
-- Now updates scenarios_resource instead of inserting into scenario_tree_junction
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
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
    -- Self-reference means root: set is_root = TRUE, parent_id = NULL
    UPDATE scenarios_resource
    SET is_root = TRUE,
        parent_id = NULL
    WHERE id = input_scenario_id;

    RETURN QUERY
    SELECT
        input_scenario_id,
        input_scenario_id,
        TRUE,
        NOW()::timestamptz;
END;
$$;
