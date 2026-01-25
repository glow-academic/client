-- View: view_activity
-- Wrapper for activity_entry. Write to _entry, read from _view.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).
-- Filters active = true by default.

CREATE OR REPLACE VIEW view_activity AS
SELECT
    id,
    last_active,
    created_at,
    updated_at,
    generated,
    mcp,
    active
FROM activity_entry
WHERE active = true;
