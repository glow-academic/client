-- Materialized View: images_mv
-- Lean image-level data for image views.
--
-- Grain: One row per image entry
-- Filter: active = true only
--
-- Purpose: Image entry with upload entry metadata (file_path, mime_type, size) + domain attrs (quality_id)
-- Section: IMAGE (lean MV)
--
-- Dependencies: images_entry, uploads_entry, uploads_uploads_connection, uploads_resource, images_qualities_connection
-- ============================================================================
-- Step 1: Drop all indexes on images_mv materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'images_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop images_mv materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS images_mv CASCADE;

-- ============================================================================
-- Step 3: Create images_mv Materialized View
-- ============================================================================

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
JOIN uploads_entry ue ON ue.id = ie.upload_id AND ue.active = true
JOIN uploads_uploads_connection uuc ON uuc.upload_id = ue.id AND uuc.active = true
JOIN uploads_resource ur ON ur.id = uuc.uploads_id AND ur.active = true
LEFT JOIN images_qualities_connection iqc ON iqc.image_id = ie.id AND iqc.active = true
WHERE ie.active = true
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX images_mv_pk
    ON images_mv (image_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX images_mv_uploads_id_idx
    ON images_mv (uploads_id);

CREATE INDEX images_mv_created_at_idx
    ON images_mv (created_at DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW images_mv;
