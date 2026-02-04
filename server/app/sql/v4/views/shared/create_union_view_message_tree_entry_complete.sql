-- Union View: message_tree_entry
-- Combines simulation_message_tree_entry and simulation_message_tree_entry
-- into a single view for backward compatibility with queries that expect a unified message_tree table.
--
-- Note: The 'type' column indicates the source table ('general', 'practice').
-- Benchmark doesn't have message_tree_entry.
-- Uses OR REPLACE for idempotent execution.

CREATE OR REPLACE VIEW message_tree_entry AS
SELECT
    mt.parent_id,
    mt.child_id,
    mt.created_at,
    mt.updated_at,
    mt.active,
    mt.generated,
    mt.mcp,
    CASE
        WHEN a.practice IS TRUE THEN 'practice'::text
        ELSE 'general'::text
    END AS type
FROM simulation_message_tree_entry mt
LEFT JOIN simulation_messages_entry m ON m.id = mt.child_id
LEFT JOIN simulation_chats_entry c ON c.id = m.chat_id
LEFT JOIN simulation_attempts_entry a ON a.id = c.attempt_id;
