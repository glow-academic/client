-- Materialized View: audios_mv
-- Lean audio-level data for audio views.
--
-- Grain: One row per audio entry
-- Filter: active = true only
--
-- Purpose: Audio entry with upload entry metadata (file_path, mime_type, size) + domain attrs (length_seconds, voice_id)
-- Section: AUDIO (lean MV)
--
-- Dependencies: audios_entry, audio_uploads_entry, uploads_entry, uploads_uploads_connection, uploads_resource, audios_voices_connection

CREATE MATERIALIZED VIEW audios_mv AS
SELECT
    ae.id  AS audio_id,
    ur.id  AS uploads_id,
    ue.file_path,
    ue.mime_type,
    ue.size,
    ae.length_seconds,
    avc.voice_id,
    ae.created_at
FROM audios_entry ae
JOIN audio_uploads_entry aue ON aue.audio_id = ae.id AND aue.active = true
JOIN uploads_entry ue ON ue.id = aue.upload_id AND ue.active = true
JOIN uploads_uploads_connection uuc ON uuc.upload_id = ue.id AND uuc.active = true
JOIN uploads_resource ur ON ur.id = uuc.uploads_id AND ur.active = true
LEFT JOIN audios_voices_connection avc ON avc.audio_id = ae.id AND avc.active = true
WHERE ae.active = true
WITH NO DATA;
