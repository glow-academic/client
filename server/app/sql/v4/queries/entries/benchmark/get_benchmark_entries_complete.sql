-- Get benchmark entries by IDs from benchmark_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_benchmark_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_benchmark_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_benchmark_entries_v4(
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
            'benchmark_id', m.benchmark_id,
            'use_groups', m.use_groups,
            'dynamic', m.dynamic,
            'eval_ids', m.eval_ids,
            'profile_ids', m.profile_ids,
            'department_ids', m.department_ids,
            'run_rubric_ids', m.run_rubric_ids,
            'group_rubric_ids', m.group_rubric_ids,
            'run_position_ids', m.run_position_ids,
            'group_position_ids', m.group_position_ids,
            'invocation_entry_ids', m.invocation_entry_ids,
            'created_at', m.created_at,
            'updated_at', m.updated_at,
            'active', m.active
        )
    ) AS items
    FROM benchmark_mv m
    WHERE m.benchmark_id = ANY(ids);
END;
$$;
