-- Search practice entries from practice_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_practice_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_practice_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_practice_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0

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
            'practice_id', m.practice_id,
            'simulation_ids', m.simulation_ids,
            'cohort_ids', m.cohort_ids,
            'department_ids', m.department_ids,
            'profile_ids', m.profile_ids,
            'rubric_ids', m.rubric_ids,
            'time_limit_ids', m.time_limit_ids,
            'flag_ids', m.flag_ids,
            'position_ids', m.position_ids,
            'persona_ids', m.persona_ids,
            'training_ids', m.training_ids,
            'scenario_ids', m.scenario_ids,
            'created_at', m.created_at,
            'updated_at', m.updated_at,
            'active', m.active
        ) AS row_data
        FROM practice_mv m
        WHERE true

        ORDER BY m.created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
