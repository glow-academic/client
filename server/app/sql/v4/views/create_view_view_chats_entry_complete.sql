-- View: view_chats_entry
-- Wrapper for chats_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_chats_entry AS
SELECT
    *
FROM chats_entry;
