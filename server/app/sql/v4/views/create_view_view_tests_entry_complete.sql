-- View: view_tests_entry
-- Wrapper for tests_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_tests_entry AS
SELECT
    *
FROM tests_entry;
