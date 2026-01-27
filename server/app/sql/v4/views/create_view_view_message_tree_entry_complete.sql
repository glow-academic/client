-- View: view_message_tree_entry
-- Wrapper for message_tree_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_message_tree_entry AS
SELECT
    *
FROM message_tree_entry;
