-- Insert scenario variant (for child scenarios)
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_insert_scenario_variant_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_insert_scenario_variant_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_insert_scenario_variant_v4(
    name text,
    generated boolean,
    active boolean,
    objectives_enabled boolean,
    images_enabled boolean,
    scenario_agent_id uuid,
    image_agent_id uuid
)
RETURNS TABLE (
    id uuid,
    name text,
    generated boolean,
    active boolean,
    objectives_enabled boolean,
    images_enabled boolean,
    scenario_agent_id uuid,
    image_agent_id uuid,
    description text,
    root_scenario_id uuid,
    parent_scenario_id uuid,
    created_at timestamptz,
    updated_at timestamptz,
    profile_id uuid,
    department_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
INSERT INTO scenarios (
    name,
    generated,
    active,
    objectives_enabled,
    images_enabled,
    scenario_agent_id,
    image_agent_id
)
VALUES (api_insert_scenario_variant_v4.name, api_insert_scenario_variant_v4.generated, api_insert_scenario_variant_v4.active, api_insert_scenario_variant_v4.objectives_enabled, api_insert_scenario_variant_v4.images_enabled, api_insert_scenario_variant_v4.scenario_agent_id, api_insert_scenario_variant_v4.image_agent_id)
RETURNING id, name, generated, active, objectives_enabled, images_enabled, scenario_agent_id, image_agent_id, description, 
    (SELECT st.parent_id FROM scenario_tree st WHERE st.child_id = scenarios.id AND st.parent_id != scenarios.id LIMIT 1) as root_scenario_id,
    (SELECT st.parent_id FROM scenario_tree st WHERE st.child_id = scenarios.id AND st.parent_id != scenarios.id LIMIT 1) as parent_scenario_id,
    created_at, updated_at, NULL::uuid as profile_id,
    (SELECT sd.department_id FROM scenario_departments sd WHERE sd.scenario_id = scenarios.id AND sd.active = true LIMIT 1) as department_id
$$;