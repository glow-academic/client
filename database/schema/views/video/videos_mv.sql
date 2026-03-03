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
-- ============================================================================
-- Step 1: Drop all indexes on videos_mv materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'videos_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop videos_mv materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS videos_mv CASCADE;

-- ============================================================================
-- Step 3: Create videos_mv Materialized View
-- ============================================================================

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

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX videos_mv_pk
    ON videos_mv (video_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX videos_mv_uploads_id_idx
    ON videos_mv (uploads_id);

CREATE INDEX videos_mv_created_at_idx
    ON videos_mv (created_at DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW videos_mv;
