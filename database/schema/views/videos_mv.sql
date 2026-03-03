-- Materialized View: videos_mv
-- Lean video-level data for video views.
--
-- Grain: One row per video entry
-- Filter: active = true only
--
-- Purpose: Video entry with upload entry metadata (file_path, mime_type, size) + domain attrs (length_seconds)
-- Section: VIDEO (lean MV)
--
-- Dependencies: videos_entry, video_uploads_entry, uploads_entry, uploads_uploads_connection, uploads_resource

CREATE MATERIALIZED VIEW videos_mv AS
SELECT
    ve.id  AS video_id,
    ur.id  AS uploads_id,
    ue.file_path,
    ue.mime_type,
    ue.size,
    ve.length_seconds,
    ve.created_at
FROM videos_entry ve
JOIN video_uploads_entry vue ON vue.video_id = ve.id AND vue.active = true
JOIN uploads_entry ue ON ue.id = vue.upload_id AND ue.active = true
JOIN uploads_uploads_connection uuc ON uuc.upload_id = ue.id AND uuc.active = true
JOIN uploads_resource ur ON ur.id = uuc.uploads_id AND ur.active = true
WHERE ve.active = true
WITH NO DATA;
