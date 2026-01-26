-- View: view_chats
-- Wrapper for chats_entry (general + practice).
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).
-- Filters active = true by default.
-- Combines general_chats_entry and practice_chats_entry via UNION ALL.
-- Also includes 'chat_type' column to distinguish general vs practice.

CREATE OR REPLACE VIEW view_chats AS
SELECT
    id,
    created_at,
    updated_at,
    title,
    completed,
    generated,
    mcp,
    active,
    attempt_id,
    'general'::text AS chat_type
FROM general_chats_entry
WHERE active = true
UNION ALL
SELECT
    id,
    created_at,
    updated_at,
    title,
    completed,
    generated,
    mcp,
    active,
    attempt_id,
    'practice'::text AS chat_type
FROM practice_chats_entry
WHERE active = true;
