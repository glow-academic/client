-- Union View: contents_entry
-- Combines general_contents_entry and practice_contents_entry
-- into a single view for backward compatibility with queries that expect a unified contents table.
--
-- Note: The 'type' column indicates the source table ('general', 'practice').
-- Benchmark doesn't have contents_entry.
-- Uses OR REPLACE for idempotent execution.

CREATE OR REPLACE VIEW contents_entry AS
SELECT
    id,
    message_id,
    content,
    idx,
    created_at,
    updated_at,
    generated,
    mcp,
    active,
    call_id,
    personas_id,
    'general'::text AS type
FROM general_contents_entry

UNION ALL

SELECT
    id,
    message_id,
    content,
    idx,
    created_at,
    updated_at,
    generated,
    mcp,
    active,
    call_id,
    personas_id,
    'practice'::text AS type
FROM practice_contents_entry;
