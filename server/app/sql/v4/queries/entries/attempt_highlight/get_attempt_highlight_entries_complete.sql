-- Get attempt_highlight entries by IDs from attempt_highlight_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_attempt_highlight_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_attempt_highlight_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_attempt_highlight_entries_v4(
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
            'highlight_id', m.highlight_id,
            'strength_id', m.strength_id,
            'section', m.section,
            'idx', m.idx,
            'created_at', m.created_at
        )
    ) AS items
    FROM attempt_highlight_mv m
    WHERE m.highlight_id = ANY(ids);
END;
$$;
