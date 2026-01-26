-- Union View: messages_entry
-- Combines general_messages_entry, practice_messages_entry, and benchmark_messages_entry
-- into a single view for backward compatibility with queries that expect a unified messages table.
--
-- Note: The 'type' column indicates the source table ('general', 'practice', 'benchmark').
-- Uses OR REPLACE for idempotent execution.

CREATE OR REPLACE VIEW messages_entry AS
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
    'general'::text AS type
FROM general_messages_entry

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
    'practice'::text AS type
FROM practice_messages_entry

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
