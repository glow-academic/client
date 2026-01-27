-- View: view_highlights_entry
-- Wrapper for highlights_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_highlights_entry AS
SELECT
    *
FROM highlights_entry;
