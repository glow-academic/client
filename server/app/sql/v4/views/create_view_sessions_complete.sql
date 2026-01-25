-- View: view_sessions
-- Wrapper for sessions_entry. Write to _entry, read from _view.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).
-- Filters active = true by default.

CREATE OR REPLACE VIEW view_sessions AS
SELECT
    id,
    created_at,
    profile_id,
    active
FROM sessions_entry
WHERE active = true;
