-- Union View: feedbacks_entry
-- Combines simulation_feedbacks_entry, simulation_feedbacks_entry, and benchmark_feedbacks_entry
-- into a single view for backward compatibility with queries that expect a unified feedbacks table.
--
-- Note: The 'type' column indicates the source table ('general', 'practice', 'benchmark').
-- Uses OR REPLACE for idempotent execution.

CREATE OR REPLACE VIEW feedbacks_entry AS
SELECT
    f.id,
    f.grade_id,
    f.total,
    f.feedback,
    f.created_at,
    f.updated_at,
    f.generated,
    f.mcp,
    f.active,
    f.call_id,
    g.total_points,
    g.pass_points,
    CASE
        WHEN a.practice IS TRUE THEN 'practice'::text
        ELSE 'general'::text
    END AS type
FROM simulation_feedbacks_entry f
LEFT JOIN simulation_grades_entry g ON g.id = f.grade_id
LEFT JOIN simulation_chats_entry c ON c.id = g.chat_id
LEFT JOIN simulation_attempts_entry a ON a.id = c.attempt_id

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
