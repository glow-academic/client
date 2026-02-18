-- Get home entries by IDs from home_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_home_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_home_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_home_entries_v4(
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
            'home_id', m.home_id,
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
        )
    ) AS items
    FROM home_mv m
    WHERE m.home_id = ANY(ids);
END;
$$;
