-- View: view_improvements_entry
-- Wrapper for improvements_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_improvements_entry AS
SELECT
    *
FROM improvements_entry;
