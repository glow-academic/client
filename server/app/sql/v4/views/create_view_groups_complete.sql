-- View: view_groups
-- Wrapper for groups_entry. Write to _entry, read from _view.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).
-- Filters active = true by default.

CREATE OR REPLACE VIEW view_groups AS
SELECT
    id,
    created_at,
    updated_at,
    trace_id,
    generated,
    mcp,
    active,
    session_id,
    name
FROM groups_entry
WHERE active = true;
