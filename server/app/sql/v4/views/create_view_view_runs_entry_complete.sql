-- View: view_runs_entry
-- Wrapper for runs_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_runs_entry AS
SELECT
    *
FROM runs_entry;
