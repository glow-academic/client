-- View: view_chat_messages_stats
-- Layer 2 Domain Aggregate View: Message counts and time deltas per chat.
-- Provides analytics-ready message statistics without hitting _entry tables.
-- Write to _entry tables, read from this _view.

CREATE OR REPLACE VIEW view_chat_messages_stats AS
WITH message_data AS (
    SELECT
        m.chat_id,
        m.role,
        m.created_at,
        m.updated_at,
        LAG(m.role) OVER w AS prev_role,
        LAG(COALESCE(m.updated_at, m.created_at)) OVER w AS prev_timestamp
    FROM view_messages_complete m
    WHERE m.chat_id IS NOT NULL
    WINDOW w AS (PARTITION BY m.chat_id ORDER BY m.created_at)
)
SELECT
    md.chat_id,
    COUNT(*)::int AS num_messages_total,
    COUNT(*) FILTER (WHERE md.role = 'user')::int AS num_query_messages,
    COUNT(*) FILTER (WHERE md.role = 'assistant')::int AS num_response_messages,
    -- Only measure persona "response → user query" gaps
    ARRAY_REMOVE(ARRAY_AGG(
        CASE WHEN md.role = 'user' AND md.prev_role = 'assistant'
             THEN GREATEST(EXTRACT(EPOCH FROM (md.created_at - md.prev_timestamp))::int, 0)
             ELSE NULL
        END ORDER BY md.created_at
    ), NULL)::int[] AS message_time_deltas
FROM message_data md
GROUP BY md.chat_id;
