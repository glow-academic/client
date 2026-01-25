-- View: view_tests
-- Wrapper for tests_entry. Write to _entry, read from _view.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).
-- Filters active = true by default.

CREATE OR REPLACE VIEW view_tests AS
SELECT
    id,
    created_at,
    updated_at,
    title,
    completed,
    trace_id,
    generated,
    mcp,
    active,
    attempt_id,
    group_id
FROM tests_entry
WHERE active = true;
