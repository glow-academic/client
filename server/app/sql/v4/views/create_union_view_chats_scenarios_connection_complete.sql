-- Union View: chats_scenarios_connection
-- Combines general_chats_scenarios_connection + practice_chats_scenarios_connection
-- into a single view for queries that need unified chat-scenario connections.
--
-- Note: The 'type' column indicates the source table ('general', 'practice').
-- Uses OR REPLACE for idempotent execution.

CREATE OR REPLACE VIEW chats_scenarios_connection AS
SELECT
    chat_id,
    scenarios_id,
    created_at,
    active,
    generated,
    mcp,
    'general'::text AS type
FROM general_chats_scenarios_connection

UNION ALL

SELECT
    chat_id,
    scenarios_id,
    created_at,
    active,
    generated,
    mcp,
    'practice'::text AS type
FROM practice_chats_scenarios_connection;
