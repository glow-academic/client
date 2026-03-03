-- Search attempt_chat_bridge entries from attempt_chat_bridge_entry table

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_attempt_chat_bridge_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_attempt_chat_bridge_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_attempt_chat_bridge_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    attempt_id uuid DEFAULT NULL,
    attempt_chat_id uuid DEFAULT NULL
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
            'attempt_id', b.attempt_id,
            'attempt_chat_id', b.attempt_chat_id,
            'chat_id', ace.chat_id,
            'created_at', b.created_at,
            'active', b.active,
            'generated', b.generated,
            'mcp', b.mcp
        ) AS row_data
        FROM attempt_chat_bridge_entry b
        JOIN attempt_chat_entry ace ON ace.id = b.attempt_chat_id AND ace.active = true
        WHERE b.active = true
          AND (attempt_id IS NULL OR b.attempt_id = attempt_id)
          AND (attempt_chat_id IS NULL OR b.attempt_chat_id = attempt_chat_id)
        ORDER BY b.created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
