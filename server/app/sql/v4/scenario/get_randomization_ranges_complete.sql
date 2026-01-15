-- Get randomization ranges for a scenario (or defaults if scenario_id is NULL)
-- Converted to PostgreSQL function
-- Note: Uses JSONB for field_ranges_json - may need refactoring per STANDARDS.md
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
        (SELECT rr.min_count FROM scenario_ranges sr JOIN ranges_resource rr ON rr.id = sr.range_id WHERE sr.scenario_id = api_get_randomization_ranges_v4.scenario_id AND sr.type = 'persona'::type_scenario_ranges LIMIT 1),
        1
    ) as persona_min,
    COALESCE(
        (SELECT rr.max_count FROM scenario_ranges sr JOIN ranges_resource rr ON rr.id = sr.range_id WHERE sr.scenario_id = api_get_randomization_ranges_v4.scenario_id AND sr.type = 'persona'::type_scenario_ranges LIMIT 1),
        3
    ) as persona_max,
    COALESCE(
        (SELECT rr.min_count FROM scenario_ranges sr JOIN ranges_resource rr ON rr.id = sr.range_id WHERE sr.scenario_id = api_get_randomization_ranges_v4.scenario_id AND sr.type = 'document'::type_scenario_ranges LIMIT 1),
        0
    ) as document_min,
    COALESCE(
        (SELECT rr.max_count FROM scenario_ranges sr JOIN ranges_resource rr ON rr.id = sr.range_id WHERE sr.scenario_id = api_get_randomization_ranges_v4.scenario_id AND sr.type = 'document'::type_scenario_ranges LIMIT 1),
        3
    ) as document_max,
    COALESCE(
        (SELECT rr.min_count FROM scenario_ranges sr JOIN ranges_resource rr ON rr.id = sr.range_id WHERE sr.scenario_id = api_get_randomization_ranges_v4.scenario_id AND sr.type = 'parameter'::type_scenario_ranges LIMIT 1),
        0
    ) as parameter_min,
    COALESCE(
        (SELECT rr.max_count FROM scenario_ranges sr JOIN ranges_resource rr ON rr.id = sr.range_id WHERE sr.scenario_id = api_get_randomization_ranges_v4.scenario_id AND sr.type = 'parameter'::type_scenario_ranges LIMIT 1),
        3
    ) as parameter_max,
    COALESCE(
        (
            SELECT jsonb_object_agg(
                p.id::text,
                jsonb_build_object(
                    'min', rr.min_count,
                    'max', rr.max_count
                )
            )
            FROM scenario_ranges sr
            JOIN ranges_resource rr ON rr.id = sr.range_id
            CROSS JOIN parameter_artifact p
            WHERE sr.scenario_id = api_get_randomization_ranges_v4.scenario_id
            AND sr.type = 'field'::type_scenario_ranges
            -- Note: field ranges are per parameter, but new structure doesn't store parameter_id
            -- This returns all field ranges for the scenario (one per parameter if they exist)
        ),
        '{}'::jsonb
    ) as field_ranges_json
$$;