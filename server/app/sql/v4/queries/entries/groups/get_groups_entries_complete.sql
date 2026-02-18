-- Get groups entries by IDs from groups_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_groups_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_groups_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_groups_entries_v4(
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
            'group_id', m.group_id,
            'session_id', m.session_id,
            'group_created_at', m.group_created_at,
            'trace_id', m.trace_id,
            'group_name', m.group_name,
            'active', m.active
        )
    ) AS items
    FROM groups_mv m
    WHERE m.group_id = ANY(ids);
END;
$$;
