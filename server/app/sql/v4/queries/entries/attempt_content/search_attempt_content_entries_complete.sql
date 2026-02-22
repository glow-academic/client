-- Search attempt_content entries from attempt_content_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_attempt_content_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_attempt_content_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_attempt_content_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    message_id uuid DEFAULT NULL,
    persona_entry_id uuid DEFAULT NULL
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
            'content_id', m.content_id,
            'message_id', m.message_id,
            'content', m.content,
            'persona_entry_id', m.persona_entry_id,
            'idx', m.idx,
            'created_at', m.created_at
        ) AS row_data
        FROM attempt_content_mv m
        WHERE true
          AND (message_id IS NULL OR m.message_id = message_id)
          AND (persona_entry_id IS NULL OR m.persona_entry_id = persona_entry_id)
        ORDER BY m.created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
