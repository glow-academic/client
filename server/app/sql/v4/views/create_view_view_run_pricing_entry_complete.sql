-- View: view_run_pricing_entry
-- Wrapper for run_pricing_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_run_pricing_entry AS
SELECT
    *
FROM run_pricing_entry;
