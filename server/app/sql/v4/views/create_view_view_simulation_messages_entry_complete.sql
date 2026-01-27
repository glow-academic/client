-- View: view_simulation_messages_entry
-- Wrapper for simulation_messages_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_simulation_messages_entry AS
SELECT
    *
FROM simulation_messages_entry;
