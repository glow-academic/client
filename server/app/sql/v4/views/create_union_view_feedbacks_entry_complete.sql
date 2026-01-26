-- Union View: feedbacks_entry
-- Combines general_feedbacks_entry, practice_feedbacks_entry, and benchmark_feedbacks_entry
-- into a single view for backward compatibility with queries that expect a unified feedbacks table.
--
-- Note: The 'type' column indicates the source table ('general', 'practice', 'benchmark').
-- Uses OR REPLACE for idempotent execution.

CREATE OR REPLACE VIEW feedbacks_entry AS
SELECT
    id,
    grade_id,
    total,
    feedback,
    created_at,
    updated_at,
    generated,
    mcp,
    active,
    call_id,
    total_points,
    pass_points,
    'general'::text AS type
FROM general_feedbacks_entry

UNION ALL

SELECT
    id,
    grade_id,
    total,
    feedback,
    created_at,
    updated_at,
    generated,
    mcp,
    active,
    call_id,
    total_points,
    pass_points,
    'practice'::text AS type
FROM practice_feedbacks_entry

UNION ALL

SELECT
    id,
    grade_id,
    total,
    feedback,
    created_at,
    updated_at,
    generated,
    mcp,
    active,
    call_id,
    total_points,
    pass_points,
    'benchmark'::text AS type
FROM benchmark_feedbacks_entry;
