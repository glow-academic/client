-- Materialized View: texts_mv
-- Lean text-level data for text views.
--
-- Grain: One row per text entry (within a texts resource)
-- Filter: active = true only
--
-- Purpose: Text entry metadata (file_path, mime_type via uploads_entry)
-- Section: TEXT (lean MV)
--
-- Dependencies: texts_resource, texts_texts_connection, texts_entry, text_uploads_entry, uploads_entry, uploads_uploads_connection, uploads_resource

CREATE MATERIALIZED VIEW texts_mv AS
SELECT
    tr.id        AS texts_id,
    te.id        AS text_id,
    ur.id        AS uploads_id,
    ue.file_path,
    ue.mime_type,
    te.created_at
FROM texts_resource tr
JOIN texts_texts_connection ttc ON ttc.texts_id = tr.id AND ttc.active = true
JOIN texts_entry te ON te.id = ttc.text_id AND te.active = true
LEFT JOIN text_uploads_entry tue ON tue.text_id = te.id AND tue.active = true
LEFT JOIN uploads_entry ue ON ue.id = tue.upload_id AND ue.active = true
LEFT JOIN uploads_uploads_connection uuc ON uuc.upload_id = ue.id AND uuc.active = true
LEFT JOIN uploads_resource ur ON ur.id = uuc.uploads_id AND ur.active = true
WHERE tr.active = true
WITH NO DATA;
