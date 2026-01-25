-- View: view_calls
-- Wrapper for calls_entry. Write to _entry, read from _view.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).
-- No active column on calls_entry, so no filter applied.

CREATE OR REPLACE VIEW view_calls AS
SELECT
    id,
    created_at,
    updated_at,
    external_call_id,
    completed,
    template_id,
    arguments_raw,
    run_id
FROM calls_entry;
