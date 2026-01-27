-- View: chats_personas_connection
-- Unified chat-persona connections with chat type derived from practice flag.
-- Uses OR REPLACE for idempotent execution.

CREATE OR REPLACE VIEW chats_personas_connection AS
SELECT
    cpc.chat_id,
    cpc.personas_id,
    cpc.created_at,
    cpc.active,
    cpc.generated,
    cpc.mcp,
    ce.chat_type AS type
FROM simulation_chats_personas_connection cpc
JOIN chats_entry ce ON ce.id = cpc.chat_id;
