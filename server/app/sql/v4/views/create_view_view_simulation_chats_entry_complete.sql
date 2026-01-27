-- View: view_simulation_chats_entry
-- Wrapper for simulation_chats_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_simulation_chats_entry AS
SELECT
    *
FROM simulation_chats_entry;
