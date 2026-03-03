-- Get test entries by IDs from test_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_test_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_test_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_test_entries_v4(
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
            'test_id', m.test_id,
            'eval_id', m.eval_id,
            'profile_id', m.profile_id,
            'department_ids', m.department_ids,
            'infinite_mode', m.infinite_mode,
            'archived', m.archived,
            'test_created_at', m.test_created_at
        )
    ) AS items
    FROM test_mv m
    WHERE m.test_id = ANY(ids);
END;
$$;
