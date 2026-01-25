-- View: view_attempts
-- Wrapper for attempts_entry. Write to _entry, read from _view.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).
-- Filters active = true by default.

CREATE OR REPLACE VIEW view_attempts AS
SELECT
    id,
    created_at,
    updated_at,
    infinite_mode,
    archived,
    generated,
    mcp,
    active
FROM attempts_entry
WHERE active = true;
