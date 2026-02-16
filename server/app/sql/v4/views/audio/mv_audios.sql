-- Materialized View: mv_audios
-- Lean audio-level data for audio views.
--
-- Grain: One row per audio entry
-- Filter: active = true only
--
-- Purpose: Audio entry with upload entry metadata (file_path, mime_type, size, length_seconds, voice_id)
-- Section: AUDIO (lean MV)
--
-- Dependencies: audios_entry, uploads_entry, uploads_uploads_connection, uploads_resource, uploads_voices_connection
-- ============================================================================
-- Step 1: Drop all indexes on mv_audios materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_audios'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_audios materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_audios CASCADE;

-- ============================================================================
-- Step 3: Create mv_audios Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_audios AS
SELECT
    ae.id  AS audio_id,
    ur.id  AS uploads_id,
    ue.file_path,
    ue.mime_type,
    ue.size,
    ue.length_seconds,
    uvc.voice_id,
    ae.created_at
FROM audios_entry ae
JOIN uploads_entry ue ON ue.id = ae.upload_id AND ue.active = true
JOIN uploads_uploads_connection uuc ON uuc.upload_id = ue.id AND uuc.active = true
JOIN uploads_resource ur ON ur.id = uuc.uploads_id AND ur.active = true
LEFT JOIN uploads_voices_connection uvc ON uvc.upload_id = ue.id AND uvc.active = true
WHERE ae.active = true
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_audios_pk
    ON mv_audios (audio_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX mv_audios_uploads_id_idx
    ON mv_audios (uploads_id);

CREATE INDEX mv_audios_created_at_idx
    ON mv_audios (created_at DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_audios;
