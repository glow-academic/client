-- Union View: grades_entry
-- Combines general_grades_entry, practice_grades_entry, and benchmark_grades_entry
-- into a single view for backward compatibility with queries that expect a unified grades table.
--
-- Note: The 'type' column indicates the source table ('general', 'practice', 'benchmark').
-- Uses OR REPLACE for idempotent execution.

CREATE OR REPLACE VIEW grades_entry AS
SELECT
    id,
    chat_id,
    run_id,
    rubric_grade_agent_id,
    created_at,
    updated_at,
    passed,
    score,
    description,
    time_taken,
    end_reason,
    generated,
    mcp,
    active,
    total_points,
    pass_points,
    'general'::text AS type
FROM general_grades_entry

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
    description,
    time_taken,
    end_reason,
    generated,
    mcp,
    active,
    total_points,
    pass_points,
    'practice'::text AS type
FROM practice_grades_entry

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
    description,
    time_taken,
    end_reason,
    generated,
    mcp,
    active,
    total_points,
    pass_points,
    'benchmark'::text AS type
FROM benchmark_grades_entry;
