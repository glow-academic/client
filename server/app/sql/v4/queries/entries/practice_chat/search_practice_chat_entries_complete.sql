-- Search practice_chat entries from practice_chat_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_practice_chat_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_practice_chat_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_practice_chat_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    practice_id uuid DEFAULT NULL,
    chat_id uuid DEFAULT NULL
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
            'id', m.id,
            'practice_id', m.practice_id,
            'chat_id', m.chat_id,
            'created_at', m.created_at,
            'active', m.active,
            'generated', m.generated,
            'mcp', m.mcp
        ) AS row_data
        FROM practice_chat_mv m
        WHERE true
          AND (practice_id IS NULL OR m.practice_id = practice_id)
          AND (chat_id IS NULL OR m.chat_id = chat_id)
        ORDER BY m.created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
