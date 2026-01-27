-- View: view_audios_entry
-- Wrapper for audios_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_audios_entry AS
SELECT
    *
FROM audios_entry;
