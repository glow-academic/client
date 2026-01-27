-- View: view_activity_entry
-- Wrapper for activity_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_activity_entry AS
SELECT
    *
FROM activity_entry;
