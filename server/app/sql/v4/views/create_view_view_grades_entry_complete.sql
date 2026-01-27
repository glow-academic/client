-- View: view_grades_entry
-- Wrapper for grades_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_grades_entry AS
SELECT
    *
FROM grades_entry;
