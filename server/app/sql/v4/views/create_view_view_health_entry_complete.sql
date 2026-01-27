-- View: view_health_entry
-- Wrapper for health_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_health_entry AS
SELECT
    *
FROM health_entry;
