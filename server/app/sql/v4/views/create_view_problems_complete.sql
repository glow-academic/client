-- View: view_problems
-- Wrapper for problems_entry. Write to _entry, read from _view.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).
-- Filters active = true by default.

CREATE OR REPLACE VIEW view_problems AS
SELECT
    id,
    created_at,
    updated_at,
    type,
    message,
    resolved,
    generated,
    mcp,
    active
FROM problems_entry
WHERE active = true;
