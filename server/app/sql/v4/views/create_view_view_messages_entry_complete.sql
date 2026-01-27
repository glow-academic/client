-- View: view_messages_entry
-- Wrapper for messages_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_messages_entry AS
SELECT
    *
FROM messages_entry;
