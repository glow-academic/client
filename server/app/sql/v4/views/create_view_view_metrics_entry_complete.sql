-- View: view_metrics_entry
-- Wrapper for metrics_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_metrics_entry AS
SELECT
    *
FROM metrics_entry;
