-- View: view_drafts
-- Wrapper for drafts_entry. Write to _entry, read from _view.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).
-- Filters active = true by default.

CREATE OR REPLACE VIEW view_drafts AS
SELECT
    id,
    version,
    created_at,
    updated_at,
    artifact,
    group_id,
    generated,
    mcp,
    active
FROM drafts_entry
WHERE active = true;
