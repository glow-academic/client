-- View: view_sessions_entry
-- Wrapper for sessions_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_sessions_entry AS
SELECT
    *
FROM sessions_entry;
