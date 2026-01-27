-- Union View: messages_entry
-- Combines simulation_messages_entry, simulation_messages_entry, and benchmark_messages_entry
-- into a single view for backward compatibility with queries that expect a unified messages table.
--
-- Note: The 'type' column indicates the source table ('general', 'practice', 'benchmark').
-- Uses OR REPLACE for idempotent execution.

CREATE OR REPLACE VIEW messages_entry AS
SELECT
    m.id,
    m.chat_id,
    m.run_id,
    m.created_at,
    m.updated_at,
    m.content,
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
FROM simulation_messages_entry m
LEFT JOIN simulation_chats_entry c ON c.id = m.chat_id
LEFT JOIN simulation_attempts_entry a ON a.id = c.attempt_id

UNION ALL

SELECT
    id,
    chat_id,
    run_id,
    created_at,
    updated_at,
    content,
    role,
    completed,
    audio,
    generated,
    mcp,
    active,
    'benchmark'::text AS type
FROM benchmark_messages_entry;
