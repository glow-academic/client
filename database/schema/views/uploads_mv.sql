-- Materialized View: uploads_mv
-- Lean upload-level data for upload views.
--
-- Grain: One row per upload entry (within an uploads resource)
-- Filter: active = true only
--
-- Purpose: Upload entry metadata (file_path, mime_type, size)
-- Section: UPLOAD (lean MV)
--
-- Dependencies: uploads_resource, uploads_uploads_connection, uploads_entry

CREATE MATERIALIZED VIEW uploads_mv AS
SELECT
    ur.id        AS uploads_id,
    ue.id        AS upload_id,
    ue.file_path,
    ue.mime_type,
    ue.size,
    ue.created_at
FROM uploads_resource ur
JOIN uploads_uploads_connection uuc ON uuc.uploads_id = ur.id AND uuc.active = true
JOIN uploads_entry ue ON ue.id = uuc.upload_id AND ue.active = true
WHERE ur.active = true
WITH NO DATA;
