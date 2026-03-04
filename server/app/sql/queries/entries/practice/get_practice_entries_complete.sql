-- Get practice entries by IDs from practice_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_practice_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_practice_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_practice_entries_v4(
    ids uuid[]
) RETURNS TABLE(
    items jsonb
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT jsonb_agg(
        jsonb_build_object(
            'practice_id', m.practice_id,
            'simulation_ids', m.simulation_ids,
            'cohort_ids', m.cohort_ids,
            'department_ids', m.department_ids,
            'profile_ids', m.profile_ids,
            'chat_ids', m.chat_ids,
            'scenario_ids', m.scenario_ids,
            'created_at', m.created_at,
            'updated_at', m.updated_at,
            'active', m.active
        )
    ) AS items
    FROM practice_mv m
    WHERE m.practice_id = ANY(ids);
END;
$$;
