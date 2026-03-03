-- Get practice_chat entries by IDs from practice_chat_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_practice_chat_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_practice_chat_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_practice_chat_entries_v4(
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
            'id', m.id,
            'practice_id', m.practice_id,
            'chat_id', m.chat_id,
            'created_at', m.created_at,
            'active', m.active,
            'generated', m.generated,
            'mcp', m.mcp
        )
    ) AS items
    FROM practice_chat_mv m
    WHERE m.id = ANY(ids);
END;
$$;
