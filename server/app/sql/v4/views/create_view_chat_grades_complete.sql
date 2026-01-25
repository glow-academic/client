-- View: view_chat_grades
-- Layer 2 Domain Aggregate View: Latest grade per chat with score, pass status, and time taken.
-- Combines view_chats + view_grades for efficient chat-grade lookups.
-- Write to _entry tables, read from this _view.

CREATE OR REPLACE VIEW view_chat_grades AS
SELECT DISTINCT ON (c.id)
    c.id AS chat_id,
    c.attempt_id,
    c.completed AS chat_completed,
    c.created_at AS chat_created_at,
    g.id AS grade_id,
    g.score,
    g.passed,
    g.time_taken,
    g.description AS grade_description,
    g.end_reason,
    g.created_at AS grade_created_at,
    g.rubric_grade_agent_id
FROM view_chats c
LEFT JOIN view_grades g ON g.chat_id = c.id
ORDER BY c.id, g.created_at DESC NULLS LAST;
