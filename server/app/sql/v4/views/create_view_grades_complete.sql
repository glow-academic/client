-- View: view_grades
-- Wrapper for grades_entry. Write to _entry, read from _view.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).
-- Filters active = true by default.

CREATE OR REPLACE VIEW view_grades AS
SELECT
    id,
    created_at,
    updated_at,
    description,
    passed,
    score,
    run_id,
    rubric_grade_agent_id,
    generated,
    mcp,
    active,
    time_taken,
    end_reason,
    chat_id
FROM grades_entry
WHERE active = true;
