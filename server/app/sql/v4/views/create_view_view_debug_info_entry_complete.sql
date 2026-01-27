-- View: view_debug_info_entry
-- Wrapper for debug_info_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_debug_info_entry AS
SELECT
    *
FROM debug_info_entry;
