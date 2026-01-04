-- Insert scenario-persona link
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_insert_scenario_persona_link_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_insert_scenario_persona_link_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_insert_scenario_persona_link_v4(
    scenario_id uuid,
    persona_id uuid,
    active boolean
)
RETURNS TABLE (
    scenario_id uuid,
    persona_id uuid,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
INSERT INTO scenario_personas (scenario_id, persona_id, active, created_at, updated_at)
VALUES (api_insert_scenario_persona_link_v4.scenario_id, api_insert_scenario_persona_link_v4.persona_id, api_insert_scenario_persona_link_v4.active, NOW(), NOW())
ON CONFLICT (scenario_id, persona_id) DO UPDATE SET
    active = EXCLUDED.active,
    updated_at = NOW()
RETURNING scenario_id, persona_id, active, created_at, updated_at
$$;