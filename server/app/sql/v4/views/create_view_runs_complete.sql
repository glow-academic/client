-- View: view_runs
-- Wrapper for runs_entry. Write to _entry, read from _view.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).
-- No active column on runs_entry, so no filter applied.

CREATE OR REPLACE VIEW view_runs AS
SELECT
    id,
    created_at,
    updated_at,
    input_tokens,
    output_tokens,
    cached_input_tokens,
    generated,
    mcp,
    group_id
FROM runs_entry;
