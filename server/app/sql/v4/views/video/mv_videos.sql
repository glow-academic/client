-- Materialized View: mv_videos
-- Lean video-level data for video views.
--
-- Grain: One row per video resource
-- Filter: active = true only
--
-- Purpose: Video resource with upload entry metadata (file_path, mime_type, size)
-- Section: VIDEO (lean MV)
--
-- Dependencies: videos_resource, uploads_resource, uploads_uploads_connection, uploads_entry
-- ============================================================================
-- Step 1: Drop all indexes on mv_videos materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_videos'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_videos materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_videos CASCADE;

-- ============================================================================
-- Step 3: Create mv_videos Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_videos AS
SELECT
    vr.id  AS video_id,
    vr.upload_id AS uploads_id,
    ue.id  AS upload_id,
    ue.file_path,
    ue.mime_type,
    ue.size,
    vr.created_at
FROM videos_resource vr
JOIN uploads_resource ur ON ur.id = vr.upload_id AND ur.active = true
JOIN uploads_uploads_connection uuc ON uuc.uploads_id = ur.id AND uuc.active = true
JOIN uploads_entry ue ON ue.id = uuc.upload_id AND ue.active = true
WHERE vr.active = true
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_videos_pk
    ON mv_videos (video_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX mv_videos_uploads_id_idx
    ON mv_videos (uploads_id);

CREATE INDEX mv_videos_created_at_idx
    ON mv_videos (created_at DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_videos;
