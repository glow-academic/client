-- Search benchmark entries from benchmark_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_benchmark_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_benchmark_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_benchmark_entries_v4(
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
            'suite_entry_ids', m.suite_entry_ids,
            'created_at', m.created_at,
            'updated_at', m.updated_at,
            'active', m.active
        ) AS row_data
        FROM benchmark_mv m
        WHERE true

        ORDER BY m.created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
