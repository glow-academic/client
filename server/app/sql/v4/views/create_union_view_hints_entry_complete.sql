-- Union View: hints_entry
-- Combines general_hints_entry and practice_hints_entry
-- into a single view for backward compatibility with queries that expect a unified hints table.
--
-- Note: The 'type' column indicates the source table ('general', 'practice').
-- Benchmark doesn't have hints_entry.
-- Uses OR REPLACE for idempotent execution.

CREATE OR REPLACE VIEW hints_entry AS
SELECT
    id,
    message_id,
    hint,
    idx,
    created_at,
    updated_at,
    generated,
    mcp,
    active,
    call_id,
    'general'::text AS type
FROM general_hints_entry

UNION ALL

SELECT
    id,
    message_id,
    hint,
    idx,
    created_at,
    updated_at,
    generated,
    mcp,
    active,
    call_id,
    'practice'::text AS type
FROM practice_hints_entry;
