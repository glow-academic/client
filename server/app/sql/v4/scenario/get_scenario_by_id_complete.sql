-- Get scenario by ID (for _create_chat_for_scenario)
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
        WHERE proname = 'api_get_scenario_by_id_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_scenario_by_id_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_scenario_by_id_v4(
    scenario_id uuid
)
RETURNS TABLE (
    id uuid,
    name text,
    description text,
    root_scenario_id uuid,
    parent_scenario_id uuid,
    created_at timestamptz,
    updated_at timestamptz,
    active boolean,
    profile_id uuid,
    department_id uuid
)
LANGUAGE sql
STABLE
AS $$
SELECT * FROM scenarios WHERE id = scenario_id
$$;

COMMIT;

