-- View: view_grants
-- Wrapper for grants_entry. Write to _entry, read from _view.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).
-- No active column on grants_entry, so no filter applied.

CREATE OR REPLACE VIEW view_grants AS
SELECT
    id,
    expires_at,
    used_at,
    revoked_at,
    created_at,
    updated_at
FROM grants_entry;
