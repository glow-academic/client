-- Union View: improvements_entry
-- Combines general_improvements_entry and practice_improvements_entry
-- into a single view for backward compatibility with queries that expect a unified improvements table.
--
-- Note: The 'type' column indicates the source table ('general', 'practice').
-- Benchmark doesn't have improvements_entry.
-- Uses OR REPLACE for idempotent execution.

CREATE OR REPLACE VIEW improvements_entry AS
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
FROM general_improvements_entry

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
FROM practice_improvements_entry;
