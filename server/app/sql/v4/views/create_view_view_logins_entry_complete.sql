-- View: view_logins_entry
-- Wrapper for logins_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_logins_entry AS
SELECT
    *
FROM logins_entry;
