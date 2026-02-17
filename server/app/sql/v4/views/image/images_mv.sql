-- Materialized View: images_mv
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
