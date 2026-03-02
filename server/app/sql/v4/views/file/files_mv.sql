-- Materialized View: files_mv
-- Lean file-level data for file views.
--
-- Grain: One row per files entry
-- Filter: active = true only
--
-- Purpose: File entry with upload entry metadata (file_path, mime_type, size)
-- Section: FILE (lean MV)
--
-- Dependencies: files_entry, uploads_entry, uploads_uploads_connection, uploads_resource
-- ============================================================================
-- Step 1: Drop all indexes on files_mv materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'files_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop files_mv materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS files_mv CASCADE;

-- ============================================================================
-- Step 3: Create files_mv Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW files_mv AS
SELECT
    fe.id  AS file_id,
    ur.id  AS uploads_id,
    ue.file_path,
    ue.mime_type,
    ue.size,
    fe.created_at
FROM files_entry fe
JOIN uploads_entry ue ON ue.id = fe.upload_id AND ue.active = true
JOIN uploads_uploads_connection uuc ON uuc.upload_id = ue.id AND uuc.active = true
JOIN uploads_resource ur ON ur.id = uuc.uploads_id AND ur.active = true
WHERE fe.active = true
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX files_mv_pk
    ON files_mv (file_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX files_mv_uploads_id_idx
    ON files_mv (uploads_id);

CREATE INDEX files_mv_mime_type_idx
    ON files_mv (mime_type);

CREATE INDEX files_mv_created_at_idx
    ON files_mv (created_at DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW files_mv;
