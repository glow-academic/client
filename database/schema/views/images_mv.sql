-- Materialized View: images_mv
-- Lean image-level data for image views.
--
-- Grain: One row per image entry
-- Filter: active = true only
--
-- Purpose: Image entry with upload entry metadata (file_path, mime_type, size) + domain attrs (quality_id)
-- Section: IMAGE (lean MV)
--
-- Dependencies: images_entry, image_uploads_entry, uploads_entry, uploads_uploads_connection, uploads_resource, images_qualities_connection

CREATE MATERIALIZED VIEW images_mv AS
SELECT
    ie.id  AS image_id,
    ur.id  AS uploads_id,
    ue.file_path,
    ue.mime_type,
    ue.size,
    iqc.quality_id,
    ie.created_at
FROM images_entry ie
JOIN image_uploads_entry iue ON iue.image_id = ie.id AND iue.active = true
JOIN uploads_entry ue ON ue.id = iue.upload_id AND ue.active = true
JOIN uploads_uploads_connection uuc ON uuc.upload_id = ue.id AND uuc.active = true
JOIN uploads_resource ur ON ur.id = uuc.uploads_id AND ur.active = true
LEFT JOIN images_qualities_connection iqc ON iqc.image_id = ie.id AND iqc.active = true
WHERE ie.active = true
WITH NO DATA;
