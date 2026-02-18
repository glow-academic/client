-- Search attempt entries from attempt_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_attempt_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_attempt_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_attempt_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    simulation_id uuid DEFAULT NULL,
    profile_id uuid DEFAULT NULL,
    cohort_id uuid DEFAULT NULL,
    department_id uuid DEFAULT NULL
) RETURNS TABLE(
    items jsonb
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT jsonb_agg(row_data) AS items
    FROM (
        SELECT jsonb_build_object(
            'attempt_id', m.attempt_id,
            'simulation_id', m.simulation_id,
            'profile_id', m.profile_id,
            'cohort_id', m.cohort_id,
            'department_id', m.department_id,
            'practice', m.practice,
            'attempt_created_at', m.attempt_created_at,
            'infinite_mode', m.infinite_mode,
            'is_archived', m.is_archived,
            'scenario_ids', m.scenario_ids
        ) AS row_data
        FROM attempt_mv m
        WHERE true
          AND (simulation_id IS NULL OR m.simulation_id = simulation_id)
          AND (profile_id IS NULL OR m.profile_id = profile_id)
          AND (cohort_id IS NULL OR m.cohort_id = cohort_id)
          AND (department_id IS NULL OR m.department_id = department_id)
        ORDER BY m.attempt_created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
