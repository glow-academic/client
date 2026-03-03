-- Materialized View: files_mv
-- Lean file-level data for file views.
--
-- Grain: One row per files entry
-- Filter: active = true only
--
-- Purpose: File entry with upload entry metadata (file_path, mime_type, size)
-- Section: FILE (lean MV)
--
-- Dependencies: files_entry, file_uploads_entry, uploads_entry, uploads_uploads_connection, uploads_resource

CREATE MATERIALIZED VIEW files_mv AS
SELECT
    fe.id  AS file_id,
    ur.id  AS uploads_id,
    ue.file_path,
    ue.mime_type,
    ue.size,
    fe.created_at
FROM files_entry fe
JOIN file_uploads_entry fue ON fue.file_id = fe.id AND fue.active = true
JOIN uploads_entry ue ON ue.id = fue.upload_id AND ue.active = true
JOIN uploads_uploads_connection uuc ON uuc.upload_id = ue.id AND uuc.active = true
JOIN uploads_resource ur ON ur.id = uuc.uploads_id AND ur.active = true
WHERE fe.active = true
WITH NO DATA;
