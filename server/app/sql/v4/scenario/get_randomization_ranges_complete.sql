-- Get randomization ranges for a scenario (returns hardcoded defaults - ranges logic removed)
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_randomization_ranges_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_randomization_ranges_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function with hardcoded defaults (ranges logic removed)
CREATE OR REPLACE FUNCTION api_get_randomization_ranges_v4(
    scenario_id uuid
)
RETURNS TABLE (
    persona_min integer,
    persona_max integer,
    document_min integer,
    document_max integer,
    parameter_min integer,
    parameter_max integer,
    field_ranges_json jsonb
)
LANGUAGE sql
STABLE
AS $$
SELECT 
    1 as persona_min,
    3 as persona_max,
    0 as document_min,
    3 as document_max,
    0 as parameter_min,
    3 as parameter_max,
    '{}'::jsonb as field_ranges_json
$$;