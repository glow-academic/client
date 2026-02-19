-- Get attempt entries by IDs from attempt_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_attempt_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_attempt_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_attempt_entries_v4(
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
            'attempt_id', m.attempt_id,
            'simulation_id', m.simulation_id,
            'profile_id', m.profile_id,
            'cohort_id', m.cohort_id,
            'department_id', m.department_id,
            'practice', m.practice,
            'attempt_created_at', m.attempt_created_at,
            'infinite_mode', m.infinite_mode,
            'is_archived', m.is_archived,
            'scenario_ids', m.scenario_ids,
            'training_entry_id', m.training_entry_id,
            'training_department_id', m.training_department_id
        )
    ) AS items
    FROM attempt_mv m
    WHERE m.attempt_id = ANY(ids);
END;
$$;
