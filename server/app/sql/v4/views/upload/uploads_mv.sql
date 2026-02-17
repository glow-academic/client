-- Materialized View: uploads_mv
-- Lean upload-level data for upload views.
--
-- Grain: One row per upload entry (within an uploads resource)
-- Filter: active = true only
--
-- Purpose: Upload entry metadata (file_path, mime_type, size)
-- Section: UPLOAD (lean MV)
--
-- Dependencies: uploads_resource, uploads_uploads_connection, uploads_entry
-- ============================================================================
-- Step 1: Drop all indexes on uploads_mv materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'uploads_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop uploads_mv materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS uploads_mv CASCADE;

-- ============================================================================
-- Step 3: Create uploads_mv Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW uploads_mv AS
SELECT
    ur.id        AS uploads_id,
    ue.id        AS upload_id,
    ue.file_path,
    ue.mime_type,
    ue.size,
    ue.length_seconds,
    ue.created_at
FROM uploads_resource ur
JOIN uploads_uploads_connection uuc ON uuc.uploads_id = ur.id AND uuc.active = true
JOIN uploads_entry ue ON ue.id = uuc.upload_id AND ue.active = true
WHERE ur.active = true
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX uploads_mv_pk
    ON uploads_mv (uploads_id, upload_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX uploads_mv_uploads_id_idx
    ON uploads_mv (uploads_id);

CREATE INDEX uploads_mv_upload_id_idx
    ON uploads_mv (upload_id);

CREATE INDEX uploads_mv_created_at_idx
    ON uploads_mv (created_at DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW uploads_mv;
