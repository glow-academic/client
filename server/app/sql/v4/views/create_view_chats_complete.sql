-- View: view_chats
-- Wrapper for chats_entry. Write to _entry, read from _view.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).
-- Filters active = true by default.

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
    attempt_id
FROM chats_entry
WHERE active = true;
