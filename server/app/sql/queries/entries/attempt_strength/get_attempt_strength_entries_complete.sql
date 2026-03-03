-- Get attempt_strength entries by IDs from attempt_strength_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_attempt_strength_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_attempt_strength_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_attempt_strength_entries_v4(
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
            'strength_id', m.strength_id,
            'message_id', m.message_id,
            'grade_id', m.grade_id,
            'name', m.name,
            'description', m.description,
            'created_at', m.created_at
        )
    ) AS items
    FROM attempt_strength_mv m
    WHERE m.strength_id = ANY(ids);
END;
$$;
