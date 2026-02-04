-- Union View: hints_entry
-- Combines simulation_hints_entry and simulation_hints_entry
-- into a single view for backward compatibility with queries that expect a unified hints table.
--
-- Note: The 'type' column indicates the source table ('general', 'practice').
-- Benchmark doesn't have hints_entry.
-- Uses OR REPLACE for idempotent execution.

CREATE OR REPLACE VIEW hints_entry AS
SELECT
    h.id,
    h.message_id,
    h.hint,
    (ROW_NUMBER() OVER (PARTITION BY h.message_id ORDER BY h.created_at) - 1)::int AS idx,
    h.created_at,
    h.updated_at,
    h.generated,
    h.mcp,
    h.active,
    h.call_id,
    CASE
        WHEN a.practice IS TRUE THEN 'practice'::text
        ELSE 'general'::text
    END AS type
FROM simulation_hints_entry h
LEFT JOIN simulation_messages_entry m ON m.id = h.message_id
LEFT JOIN simulation_chats_entry c ON c.id = m.chat_id
LEFT JOIN simulation_attempts_entry a ON a.id = c.attempt_id;
