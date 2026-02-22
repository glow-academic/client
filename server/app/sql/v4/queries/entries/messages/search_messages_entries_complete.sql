-- Search messages entries from messages_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_messages_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_messages_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_messages_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    run_id uuid DEFAULT NULL
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
            'message_id', m.message_id,
            'run_id', m.run_id,
            'role', m.role,
            'message_created_at', m.message_created_at,
            'contents', m.contents,
            'call_ids', m.call_ids
        ) AS row_data
        FROM messages_mv m
        WHERE true
          AND (run_id IS NULL OR m.run_id = run_id)
        ORDER BY m.message_created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
