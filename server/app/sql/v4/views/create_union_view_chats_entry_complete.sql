-- View: chats_entry
-- Unified simulation chats entry (single source of truth).
-- Includes inactive rows and preserves the historical schema shape.
-- Uses OR REPLACE for idempotent execution.

CREATE OR REPLACE VIEW chats_entry AS
SELECT
    c.id,
    c.attempt_id,
    c.created_at,
    c.updated_at,
    c.title,
    c.completed,
    c.generated,
    c.mcp,
    c.active,
    CASE
        WHEN a.practice IS TRUE THEN 'practice'::text
        ELSE 'general'::text
    END AS chat_type
FROM simulation_chats_entry c
JOIN simulation_attempts_entry a ON a.id = c.attempt_id;
