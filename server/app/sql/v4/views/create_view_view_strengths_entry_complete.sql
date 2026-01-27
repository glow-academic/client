-- View: view_strengths_entry
-- Wrapper for strengths_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_strengths_entry AS
SELECT
    *
FROM strengths_entry;
