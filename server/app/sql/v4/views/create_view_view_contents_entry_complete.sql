-- View: view_contents_entry
-- Wrapper for contents_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_contents_entry AS
SELECT
    *
FROM contents_entry;
