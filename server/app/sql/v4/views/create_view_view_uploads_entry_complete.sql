-- View: view_uploads_entry
-- Wrapper for uploads_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_uploads_entry AS
SELECT
    *
FROM uploads_entry;
