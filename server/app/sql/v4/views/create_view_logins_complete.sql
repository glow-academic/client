-- View: view_logins
-- Wrapper for logins_entry. Write to _entry, read from _view.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).
-- Filters active = true by default.

CREATE OR REPLACE VIEW view_logins AS
SELECT
    id,
    last_login,
    created_at,
    updated_at,
    generated,
    mcp,
    active,
    call_id
FROM logins_entry
WHERE active = true;
