-- View: view_emulations
-- Wrapper for emulations_entry. Write to _entry, read from _view.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).
-- No active column on emulations_entry, so no filter applied.

CREATE OR REPLACE VIEW view_emulations AS
SELECT
    id,
    grant_id,
    created_at,
    updated_at
FROM emulations_entry;
