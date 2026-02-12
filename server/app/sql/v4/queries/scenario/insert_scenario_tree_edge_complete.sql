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
-- Now updates scenarios_resource.parent_id / is_root instead of scenario_tree_junction.
-- Self-reference (parent_id = child_id) means "this is a root" → SET is_root = TRUE, parent_id = NULL.
-- Otherwise, SET parent_id = the given parent_id.
CREATE OR REPLACE FUNCTION api_insert_scenario_tree_edge_v4(
    p_parent_id uuid,
    p_child_id uuid,
    p_active boolean
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
    IF p_parent_id = p_child_id THEN
        -- Self-reference: mark as root
        UPDATE scenarios_resource
        SET is_root = TRUE,
            parent_id = NULL
        WHERE id = p_child_id;
    ELSE
        -- Non-self-reference: set parent
        UPDATE scenarios_resource
        SET parent_id = p_parent_id,
            is_root = FALSE
        WHERE id = p_child_id;
    END IF;

    RETURN QUERY
    SELECT
        p_parent_id,
        p_child_id,
        p_active,
        NOW()::timestamptz;
END;
$$;