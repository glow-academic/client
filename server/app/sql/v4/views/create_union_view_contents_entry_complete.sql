-- Union View: contents_entry
-- Combines simulation_contents_entry and simulation_contents_entry
-- into a single view for backward compatibility with queries that expect a unified contents table.
--
-- Note: The 'type' column indicates the source table ('general', 'practice').
-- Benchmark doesn't have contents_entry.
-- Uses OR REPLACE for idempotent execution.

CREATE OR REPLACE VIEW contents_entry AS
SELECT
    ce.id,
    ce.message_id,
    ce.content,
    ce.idx,
    ce.created_at,
    ce.updated_at,
    ce.generated,
    ce.mcp,
    ce.active,
    ce.call_id,
    ce.personas_id,
    CASE
        WHEN a.practice IS TRUE THEN 'practice'::text
        ELSE 'general'::text
    END AS type
FROM simulation_contents_entry ce
LEFT JOIN simulation_messages_entry m ON m.id = ce.message_id
LEFT JOIN simulation_chats_entry c ON c.id = m.chat_id
LEFT JOIN simulation_attempts_entry a ON a.id = c.attempt_id;
