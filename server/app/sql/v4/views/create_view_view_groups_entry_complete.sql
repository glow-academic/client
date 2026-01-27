-- View: view_groups_entry
-- Wrapper for groups_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_groups_entry AS
SELECT
    *
FROM groups_entry;
