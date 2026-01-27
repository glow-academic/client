-- View: view_audits_entry
-- Wrapper for audits_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_audits_entry AS
SELECT
    *
FROM audits_entry;
