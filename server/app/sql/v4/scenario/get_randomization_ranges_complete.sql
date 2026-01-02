-- Get randomization ranges for a scenario (or defaults if scenario_id is NULL)
-- Converted to PostgreSQL function
-- Note: Uses JSONB for field_ranges_json - may need refactoring per STANDARDS.md

BEGIN;

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

-- Recreate function
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
    COALESCE(
        (SELECT min_count FROM scenario_persona_ranges WHERE scenario_id = api_get_randomization_ranges_v4.scenario_id),
        1
    ) as persona_min,
    COALESCE(
        (SELECT max_count FROM scenario_persona_ranges WHERE scenario_id = api_get_randomization_ranges_v4.scenario_id),
        3
    ) as persona_max,
    COALESCE(
        (SELECT min_count FROM scenario_document_ranges WHERE scenario_id = api_get_randomization_ranges_v4.scenario_id),
        0
    ) as document_min,
    COALESCE(
        (SELECT max_count FROM scenario_document_ranges WHERE scenario_id = api_get_randomization_ranges_v4.scenario_id),
        3
    ) as document_max,
    COALESCE(
        (SELECT min_count FROM scenario_parameter_ranges WHERE scenario_id = api_get_randomization_ranges_v4.scenario_id),
        0
    ) as parameter_min,
    COALESCE(
        (SELECT max_count FROM scenario_parameter_ranges WHERE scenario_id = api_get_randomization_ranges_v4.scenario_id),
        3
    ) as parameter_max,
    COALESCE(
        (
            SELECT jsonb_object_agg(
                parameter_id::text,
                jsonb_build_object(
                    'min', min_count,
                    'max', max_count
                )
            )
            FROM scenario_field_ranges
            WHERE scenario_id = api_get_randomization_ranges_v4.scenario_id
        ),
        '{}'::jsonb
    ) as field_ranges_json
$$;

COMMIT;

