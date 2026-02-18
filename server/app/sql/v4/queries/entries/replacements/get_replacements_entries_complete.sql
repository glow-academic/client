-- Get replacements entries by IDs from replacements_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_replacements_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_replacements_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_replacements_entries_v4(
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
            'idx', m.idx,
            'section', m.section,
            'replace', m.replace,
            'created_at', m.created_at,
            'message_feedback_id', m.message_feedback_id,
            'generated', m.generated,
            'mcp', m.mcp,
            'active', m.active,
            'updated_at', m.updated_at
        )
    ) AS items
    FROM replacements_mv m
    WHERE m.message_feedback_id = ANY(ids);
END;
$$;
