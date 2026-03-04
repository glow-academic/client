-- Get responses entries by IDs from attempt_responses_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_responses_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_responses_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_responses_entries_v4(
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
            'response_id', m.response_id,
            'chat_id', m.chat_id,
            'question_id', m.question_id,
            'option_id', m.option_id,
            'created_at', m.created_at
        )
    ) AS items
    FROM attempt_responses_mv m
    WHERE m.response_id = ANY(ids);
END;
$$;
