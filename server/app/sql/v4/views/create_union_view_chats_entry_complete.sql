-- Union View: chats_entry
-- Combines general_chats_entry + practice_chats_entry
-- into a single view for queries that need full chat history (including inactive).
--
-- Note: The 'chat_type' column indicates the source table ('general', 'practice').
-- Unlike view_chat_base_complete, this view does NOT filter by active and does NOT include connections.
-- Use this when you need the raw entry data without joins.
-- Uses OR REPLACE for idempotent execution.

CREATE OR REPLACE VIEW chats_entry AS
SELECT
    id,
    attempt_id,
    created_at,
    updated_at,
    title,
    completed,
    generated,
    mcp,
    active,
    'general'::text AS chat_type
FROM general_chats_entry

UNION ALL

SELECT
    id,
    attempt_id,
    created_at,
    updated_at,
    title,
    completed,
    generated,
    mcp,
    active,
    'practice'::text AS chat_type
FROM practice_chats_entry;
