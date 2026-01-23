-- Insert scenario tree edge
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_insert_scenario_tree_edge_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_insert_scenario_tree_edge_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_insert_scenario_tree_edge_v4(
    parent_id uuid,
    child_id uuid,
    active boolean
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
INSERT INTO scenario_tree_junction (parent_id, child_id, active)
VALUES (api_insert_scenario_tree_edge_v4.parent_id, api_insert_scenario_tree_edge_v4.child_id, api_insert_scenario_tree_edge_v4.active)
ON CONFLICT (parent_id, child_id) DO UPDATE SET
    active = EXCLUDED.active
RETURNING parent_id, child_id, active, created_at
$$;