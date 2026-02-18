-- Get attempt_content entries by IDs from attempt_content_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_attempt_content_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_attempt_content_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_attempt_content_entries_v4(
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
            'content_id', m.content_id,
            'message_id', m.message_id,
            'content', m.content,
            'persona_entry_id', m.persona_entry_id,
            'idx', m.idx,
            'created_at', m.created_at
        )
    ) AS items
    FROM attempt_content_mv m
    WHERE m.content_id = ANY(ids);
END;
$$;
