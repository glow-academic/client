-- Union View: strengths_entry
-- Combines simulation_strengths_entry and simulation_strengths_entry
-- into a single view for backward compatibility with queries that expect a unified strengths table.
--
-- Note: The 'type' column indicates the source table ('general', 'practice').
-- Benchmark doesn't have strengths_entry.
-- Uses OR REPLACE for idempotent execution.

CREATE OR REPLACE VIEW strengths_entry AS
SELECT
    s.id,
    s.grade_id,
    s.message_id,
    s.name,
    s.description,
    s.created_at,
    s.updated_at,
    s.generated,
    s.mcp,
    s.active,
    s.call_id,
    CASE
        WHEN a.practice IS TRUE THEN 'practice'::text
        ELSE 'general'::text
    END AS type
FROM simulation_strengths_entry s
LEFT JOIN simulation_grades_entry g ON g.id = s.grade_id
LEFT JOIN simulation_messages_entry m ON m.id = s.message_id
LEFT JOIN simulation_chats_entry c ON c.id = COALESCE(g.chat_id, m.chat_id)
LEFT JOIN simulation_attempts_entry a ON a.id = c.attempt_id;
