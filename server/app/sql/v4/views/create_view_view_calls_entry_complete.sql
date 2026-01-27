-- View: view_calls_entry
-- Wrapper for calls_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_calls_entry AS
SELECT
    *
FROM calls_entry;
