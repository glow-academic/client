-- View: view_drafts_entry
-- Wrapper for drafts_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_drafts_entry AS
SELECT
    *
FROM drafts_entry;
