-- Union View: simulation_contents_unified_view
-- Combines simulation_contents_entry with contents_entry base table
-- to provide full content data with persona associations.
--
-- Note: The 'type' column indicates the source context ('general', 'practice').
-- Uses OR REPLACE for idempotent execution.
--
-- IMPORTANT: This view is named simulation_contents_unified_view (not contents_entry)
-- because contents_entry is now a base table that stores the core content data.
--
-- Schema changes in migration 364:
-- - Old: simulation_contents_entry had (id, message_id, content, idx, personas_id, ...)
-- - New: simulation_contents_entry has (content_id, simulation_message_id, persona_id, ...)
-- - New: contents_entry (base table) has (id, message_id, content, call_id, ...)

CREATE OR REPLACE VIEW simulation_contents_unified_view AS
SELECT
    ce.id,
    sce.simulation_message_id AS message_id,
    ce.content,
    ce.created_at,
    ce.updated_at,
    ce.generated,
    ce.mcp,
    ce.active,
    ce.call_id,
    sce.persona_id,
    CASE
        WHEN a.practice IS TRUE THEN 'practice'::text
        ELSE 'general'::text
    END AS type
FROM simulation_contents_entry sce
JOIN contents_entry ce ON ce.id = sce.content_id
LEFT JOIN simulation_messages_entry sm ON sm.id = sce.simulation_message_id
LEFT JOIN simulation_chats_entry c ON c.id = sm.chat_id
LEFT JOIN simulation_attempts_entry a ON a.id = c.attempt_id;
