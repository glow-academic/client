-- View: view_emulations_entry
-- Wrapper for emulations_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_emulations_entry AS
SELECT
    *
FROM emulations_entry;
