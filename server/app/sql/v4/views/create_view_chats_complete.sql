-- View: view_chats
-- Wrapper for chats_entry (simulation only).
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).
-- Filters active = true by default.

CREATE OR REPLACE VIEW view_chats AS
SELECT
    c.id,
    c.created_at,
    c.updated_at,
    c.title,
    c.completed,
    c.generated,
    c.mcp,
    c.active,
    c.attempt_id,
    CASE
        WHEN a.practice IS TRUE THEN 'practice'::text
        ELSE 'general'::text
    END AS chat_type
FROM simulation_chats_entry c
JOIN simulation_attempts_entry a ON a.id = c.attempt_id
WHERE c.active = true;
