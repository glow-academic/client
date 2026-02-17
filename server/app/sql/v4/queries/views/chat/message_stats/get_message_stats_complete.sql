-- ============================================================================
-- Query: get_message_stats
-- Purpose: Fetch message count and avg response time per chat
-- Section: VIEWS/CHAT/MESSAGE_STATS
--
-- Replaces the message_stats CTE from mv_profile_facts.
-- Uses entry tables directly (lightweight when filtered by chat_ids).
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_message_stats_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_message_stats_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_message_stats_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_get_message_stats_v4_item AS (
    chat_id uuid,
    num_messages_total int,
    avg_response_sec numeric
);

CREATE OR REPLACE FUNCTION api_get_message_stats_v4(
    chat_ids uuid[]
)
RETURNS TABLE (
    items types.q_get_message_stats_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
    WITH stats AS (
        SELECT
            sm.chat_id,
            COUNT(*)::int AS num_messages_total,
            ROUND(
                AVG(
                    EXTRACT(EPOCH FROM (sm.updated_at - sm.created_at))
                ) FILTER (WHERE m.role = 'assistant'::message_type),
                2
            ) AS avg_response_sec
        FROM attempt_message_entry sm
        JOIN messages_entry m ON m.id = sm.id
        WHERE sm.chat_id = ANY(chat_ids)
          AND m.active = TRUE
          AND m.role IN ('user'::message_type, 'assistant'::message_type)
        GROUP BY sm.chat_id
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (chat_id, num_messages_total, avg_response_sec)::types.q_get_message_stats_v4_item
            ),
            ARRAY[]::types.q_get_message_stats_v4_item[]
        ) AS items
        FROM stats
    )
    SELECT items FROM items_agg;
$$;
