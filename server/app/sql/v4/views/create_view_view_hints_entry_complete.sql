-- View: view_hints_entry
-- Wrapper for hints_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_hints_entry AS
SELECT
    *
FROM hints_entry;
