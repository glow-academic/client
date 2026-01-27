-- View: chats_scenarios_connection
-- Unified chat-scenario connections with chat type derived from practice flag.
-- Uses OR REPLACE for idempotent execution.

CREATE OR REPLACE VIEW chats_scenarios_connection AS
SELECT
    csc.chat_id,
    csc.scenarios_id,
    csc.created_at,
    csc.active,
    csc.generated,
    csc.mcp,
    ce.chat_type AS type
FROM simulation_chats_scenarios_connection csc
JOIN chats_entry ce ON ce.id = csc.chat_id;
