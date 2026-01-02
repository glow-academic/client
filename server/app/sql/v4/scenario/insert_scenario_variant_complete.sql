-- Insert scenario variant (for child scenarios)
-- Converted to PostgreSQL function

BEGIN;

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
VALUES (name, generated, active, objectives_enabled, images_enabled, scenario_agent_id, image_agent_id)
RETURNING *
$$;

COMMIT;

