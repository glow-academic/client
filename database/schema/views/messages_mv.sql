-- Materialized View: messages_mv
-- Lean message-level data for group detail pages.
--
-- Grain: One row per message (with run_id)
-- Filter: active = TRUE AND run_id IS NOT NULL
--
-- Purpose: Pre-aggregates upload IDs by media type from upload chain
-- Section: MESSAGE (lean MV - used by group detail artifact)
--
-- Dependencies: messages_entry, message_uploads_entry, uploads_entry, *_uploads_entry

CREATE MATERIALIZED VIEW messages_mv AS
WITH
uploads_agg AS (
    SELECT
        mue.message_id,
        COALESCE(ARRAY_AGG(DISTINCT u.id) FILTER (WHERE tu.id IS NOT NULL), ARRAY[]::uuid[]) AS text_upload_ids,
        COALESCE(ARRAY_AGG(DISTINCT u.id) FILTER (WHERE au.id IS NOT NULL), ARRAY[]::uuid[]) AS audio_upload_ids,
        COALESCE(ARRAY_AGG(DISTINCT u.id) FILTER (WHERE iu.id IS NOT NULL), ARRAY[]::uuid[]) AS image_upload_ids,
        COALESCE(ARRAY_AGG(DISTINCT u.id) FILTER (WHERE vu.id IS NOT NULL), ARRAY[]::uuid[]) AS video_upload_ids,
        COALESCE(ARRAY_AGG(DISTINCT u.id) FILTER (WHERE fu.id IS NOT NULL), ARRAY[]::uuid[]) AS file_upload_ids,
        COALESCE(ARRAY_AGG(DISTINCT u.id) FILTER (WHERE cu.id IS NOT NULL), ARRAY[]::uuid[]) AS call_upload_ids
    FROM message_uploads_entry mue
    JOIN uploads_entry u ON u.id = mue.upload_id AND u.active = TRUE
    LEFT JOIN text_uploads_entry tu ON tu.upload_id = u.id AND tu.active = TRUE
    LEFT JOIN audio_uploads_entry au ON au.upload_id = u.id AND au.active = TRUE
    LEFT JOIN image_uploads_entry iu ON iu.upload_id = u.id AND iu.active = TRUE
    LEFT JOIN video_uploads_entry vu ON vu.upload_id = u.id AND vu.active = TRUE
    LEFT JOIN file_uploads_entry fu ON fu.upload_id = u.id AND fu.active = TRUE
    LEFT JOIN call_uploads_entry cu ON cu.upload_id = u.id AND cu.active = TRUE
    WHERE mue.active = TRUE
    GROUP BY mue.message_id
)
SELECT
    m.id AS message_id,
    m.run_id,
    m.role::text AS role,
    m.created_at AS message_created_at,
    COALESCE(ua.text_upload_ids, ARRAY[]::uuid[]) AS text_upload_ids,
    COALESCE(ua.audio_upload_ids, ARRAY[]::uuid[]) AS audio_upload_ids,
    COALESCE(ua.image_upload_ids, ARRAY[]::uuid[]) AS image_upload_ids,
    COALESCE(ua.video_upload_ids, ARRAY[]::uuid[]) AS video_upload_ids,
    COALESCE(ua.file_upload_ids, ARRAY[]::uuid[]) AS file_upload_ids,
    COALESCE(ua.call_upload_ids, ARRAY[]::uuid[]) AS call_upload_ids
FROM messages_entry m
LEFT JOIN uploads_agg ua ON ua.message_id = m.id
WHERE m.active = TRUE AND m.run_id IS NOT NULL
WITH NO DATA;
