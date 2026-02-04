-- Union View: improvements_entry
-- Combines simulation_improvements_entry and simulation_improvements_entry
-- into a single view for backward compatibility with queries that expect a unified improvements table.
--
-- Note: The 'type' column indicates the source table ('general', 'practice').
-- Benchmark doesn't have improvements_entry.
-- Uses OR REPLACE for idempotent execution.

CREATE OR REPLACE VIEW improvements_entry AS
SELECT
    i.id,
    i.grade_id,
    i.message_id,
    i.name,
    i.description,
    i.created_at,
    i.updated_at,
    i.generated,
    i.mcp,
    i.active,
    i.call_id,
    CASE
        WHEN a.practice IS TRUE THEN 'practice'::text
        ELSE 'general'::text
    END AS type
FROM simulation_improvements_entry i
LEFT JOIN simulation_grades_entry g ON g.id = i.grade_id
LEFT JOIN simulation_messages_entry m ON m.id = i.message_id
LEFT JOIN simulation_chats_entry c ON c.id = COALESCE(g.chat_id, m.chat_id)
LEFT JOIN simulation_attempts_entry a ON a.id = c.attempt_id;
