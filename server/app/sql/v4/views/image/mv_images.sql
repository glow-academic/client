-- Materialized View: mv_images
-- Lean image-level data for image views.
--
-- Grain: One row per image resource
-- Filter: active = true only
--
-- Purpose: Image resource with upload entry metadata (file_path, mime_type, size)
-- Section: IMAGE (lean MV)
--
-- Dependencies: images_resource, uploads_resource, uploads_uploads_connection, uploads_entry
-- ============================================================================
-- Step 1: Drop all indexes on mv_images materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_images'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_images materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_images CASCADE;

-- ============================================================================
-- Step 3: Create mv_images Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_images AS
SELECT
    ir.id  AS image_id,
    ir.upload_id AS uploads_id,
    ue.id  AS upload_id,
    ue.file_path,
    ue.mime_type,
    ue.size,
    uqc.quality_id,
    ir.created_at
FROM images_resource ir
JOIN uploads_resource ur ON ur.id = ir.upload_id AND ur.active = true
JOIN uploads_uploads_connection uuc ON uuc.uploads_id = ur.id AND uuc.active = true
JOIN uploads_entry ue ON ue.id = uuc.upload_id AND ue.active = true
LEFT JOIN uploads_qualities_connection uqc ON uqc.upload_id = ue.id AND uqc.active = true
WHERE ir.active = true
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_images_pk
    ON mv_images (image_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX mv_images_uploads_id_idx
    ON mv_images (uploads_id);

CREATE INDEX mv_images_created_at_idx
    ON mv_images (created_at DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_images;
