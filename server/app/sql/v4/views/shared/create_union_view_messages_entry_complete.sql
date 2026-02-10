-- Union View: simulation_messages_unified_view
-- Combines simulation_messages_entry only into a single view
-- with full message data by joining to messages_entry base table.
--
-- Note: The 'type' column indicates the source table ('general', 'practice').
-- Uses DROP/CREATE for idempotent execution.
--
-- IMPORTANT: This view is named simulation_messages_unified_view (not messages_entry)
-- because messages_entry is now a base table that stores the core message data.

DROP VIEW IF EXISTS simulation_messages_unified_view CASCADE;

CREATE VIEW simulation_messages_unified_view AS
SELECT
    sm.id,
    sm.chat_id,
    m.run_id,
    sm.created_at,
    sm.updated_at,
    m.role,
    m.completed,
    m.audio,
    m.generated,
    m.mcp,
    m.active,
    CASE
        WHEN a.practice IS TRUE THEN 'practice'::text
        ELSE 'general'::text
    END AS type
FROM simulation_messages_entry sm
JOIN messages_entry m ON m.id = sm.id
LEFT JOIN simulation_chats_entry c ON c.id = sm.chat_id
LEFT JOIN simulation_attempts_entry a ON a.id = c.attempt_id

;
