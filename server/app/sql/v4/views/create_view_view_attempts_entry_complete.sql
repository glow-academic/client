-- View: view_attempts_entry
-- Wrapper for attempts_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_attempts_entry AS
SELECT
    *
FROM attempts_entry;
