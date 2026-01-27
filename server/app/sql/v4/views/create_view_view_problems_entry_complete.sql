-- View: view_problems_entry
-- Wrapper for problems_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_problems_entry AS
SELECT
    *
FROM problems_entry;
