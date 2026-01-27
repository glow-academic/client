-- View: view_grants_entry
-- Wrapper for grants_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_grants_entry AS
SELECT
    *
FROM grants_entry;
