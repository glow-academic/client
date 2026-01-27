-- View: view_replacements_entry
-- Wrapper for replacements_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_replacements_entry AS
SELECT
    *
FROM replacements_entry;
