-- View: view_uploads
-- Wrapper for uploads_entry. Write to _entry, read from _view.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).
-- Filters active = true by default.

CREATE OR REPLACE VIEW view_uploads AS
SELECT
    id,
    created_at,
    updated_at,
    file_path,
    mime_type,
    size,
    generated,
    mcp,
    active
FROM uploads_entry
WHERE active = true;
