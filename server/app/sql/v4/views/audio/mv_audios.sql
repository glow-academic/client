-- Materialized View: mv_audios
-- Lean audio-level data for audio views.
--
-- Grain: One row per audio resource
-- Filter: active = true only
--
-- Purpose: Audio resource with upload entry metadata + call_id/message_id
-- Section: AUDIO (lean MV)
--
-- Dependencies: audios_resource, audios_audios_connection, audios_entry,
--               uploads_resource, uploads_uploads_connection, uploads_entry
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
    ar.id  AS audio_id,
    ar.upload_id AS uploads_id,
    ue.id  AS upload_id,
    ae.call_id,
    ae.message_id,
    ue.file_path,
    ue.mime_type,
    ue.size,
    ar.created_at
FROM audios_resource ar
JOIN audios_audios_connection aac ON aac.audios_id = ar.id AND aac.active = true
JOIN audios_entry ae ON ae.id = aac.audio_id AND ae.active = true
JOIN uploads_resource ur ON ur.id = ar.upload_id AND ur.active = true
JOIN uploads_uploads_connection uuc ON uuc.uploads_id = ur.id AND uuc.active = true
JOIN uploads_entry ue ON ue.id = uuc.upload_id AND ue.active = true
WHERE ar.active = true
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

CREATE INDEX mv_audios_message_id_idx
    ON mv_audios (message_id)
    WHERE message_id IS NOT NULL;

CREATE INDEX mv_audios_created_at_idx
    ON mv_audios (created_at DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_audios;
