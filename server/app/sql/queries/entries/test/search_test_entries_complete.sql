-- Search test entries from test_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_test_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_test_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_test_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    eval_id uuid DEFAULT NULL,
    profile_id uuid DEFAULT NULL
) RETURNS TABLE(
    items jsonb
)
LANGUAGE plpgsql STABLE
AS $$
#variable_conflict use_variable
BEGIN
    RETURN QUERY
    SELECT jsonb_agg(row_data) AS items
    FROM (
        SELECT jsonb_build_object(
            'test_id', m.test_id,
            'eval_id', m.eval_id,
            'profile_id', m.profile_id,
            'department_ids', m.department_ids,
            'infinite_mode', m.infinite_mode,
            'archived', m.archived,
            'test_created_at', m.test_created_at
        ) AS row_data
        FROM test_mv m
        WHERE true
          AND (eval_id IS NULL OR m.eval_id = eval_id)
          AND (profile_id IS NULL OR m.profile_id = profile_id)
        ORDER BY m.test_created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
