-- Search responses entries from attempt_responses_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_responses_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_responses_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_responses_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    chat_id uuid DEFAULT NULL,
    question_id uuid DEFAULT NULL,
    option_id uuid DEFAULT NULL
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
            'response_id', m.response_id,
            'chat_id', m.chat_id,
            'question_id', m.question_id,
            'option_id', m.option_id,
            'created_at', m.created_at
        ) AS row_data
        FROM attempt_responses_mv m
        WHERE true
          AND (chat_id IS NULL OR m.chat_id = chat_id)
          AND (question_id IS NULL OR m.question_id = question_id)
          AND (option_id IS NULL OR m.option_id = option_id)
        ORDER BY m.created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
