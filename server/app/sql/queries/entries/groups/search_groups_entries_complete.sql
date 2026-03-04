-- Search groups entries from groups_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_groups_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_groups_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_groups_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    session_id uuid DEFAULT NULL
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
            'group_id', m.group_id,
            'session_id', m.session_id,
            'group_created_at', m.group_created_at,
            'group_name', m.group_name,
            'active', m.active
        ) AS row_data
        FROM groups_mv m
        WHERE true
          AND (session_id IS NULL OR m.session_id = session_id)
        ORDER BY m.group_created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
