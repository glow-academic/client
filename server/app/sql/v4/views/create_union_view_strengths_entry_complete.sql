-- Union View: strengths_entry
-- Combines general_strengths_entry and practice_strengths_entry
-- into a single view for backward compatibility with queries that expect a unified strengths table.
--
-- Note: The 'type' column indicates the source table ('general', 'practice').
-- Benchmark doesn't have strengths_entry.
-- Uses OR REPLACE for idempotent execution.

CREATE OR REPLACE VIEW strengths_entry AS
SELECT
    id,
    grade_id,
    message_id,
    name,
    description,
    created_at,
    updated_at,
    generated,
    mcp,
    active,
    call_id,
    'general'::text AS type
FROM general_strengths_entry

UNION ALL

SELECT
    id,
    grade_id,
    message_id,
    name,
    description,
    created_at,
    updated_at,
    generated,
    mcp,
    active,
    call_id,
    'practice'::text AS type
FROM practice_strengths_entry;
