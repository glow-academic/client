-- View: view_audits
-- Wrapper for audits_entry. Write to _entry, read from _view.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).
-- No active column on audits_entry, so no filter applied.

CREATE OR REPLACE VIEW view_audits AS
SELECT
    id,
    created_at,
    message,
    endpoint,
    error,
    session_id
FROM audits_entry;
