-- Union View: grades_entry
-- Combines simulation_grades_entry, simulation_grades_entry, and benchmark_grades_entry
-- into a single view for backward compatibility with queries that expect a unified grades table.
--
-- Note: The 'type' column indicates the source table ('general', 'practice', 'benchmark').
-- Uses OR REPLACE for idempotent execution.

CREATE OR REPLACE VIEW grades_entry AS
SELECT
    g.id,
    g.chat_id,
    g.run_id,
    g.rubric_grade_agent_id,
    g.created_at,
    g.updated_at,
    g.passed,
    g.score,
    g.time_taken,
    g.generated,
    g.mcp,
    g.active,
    g.total_points,
    g.pass_points,
    CASE
        WHEN a.practice IS TRUE THEN 'practice'::text
        ELSE 'general'::text
    END AS type
FROM simulation_grades_entry g
LEFT JOIN simulation_chats_entry c ON c.id = g.chat_id
LEFT JOIN simulation_attempts_entry a ON a.id = c.attempt_id

UNION ALL

SELECT
    id,
    chat_id,
    run_id,
    rubric_grade_agent_id,
    created_at,
    updated_at,
    passed,
    score,
    time_taken,
    generated,
    mcp,
    active,
    total_points,
    pass_points,
    'benchmark'::text AS type
FROM benchmark_grades_entry;
