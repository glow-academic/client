-- Materialized View: calls_mv
-- Lean call-level data for group detail pages.
--
-- Grain: One row per call (with run_id)
-- Filter: run_id IS NOT NULL
--
-- Purpose: Exposes tool_id (resource ID) — name resolved in hydration layer
-- Section: CALL (lean MV - used by group detail artifact)
--
-- Dependencies: calls_entry, call_uploads_entry, uploads_entry, uploads_uploads_connection, uploads_resource, tools_calls_connection
-- ============================================================================
-- Step 1: Drop all indexes on calls_mv materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'calls_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop calls_mv materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS calls_mv CASCADE;

-- ============================================================================
-- Step 3: Create calls_mv Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW calls_mv AS
SELECT
    c.id AS call_id,
    c.run_id,
    c.created_at AS call_created_at,
    ur.id AS uploads_id,
    ue.file_path,
    ue.mime_type,
    tcc.tools_id AS tool_id
FROM calls_entry c
LEFT JOIN call_uploads_entry cue ON cue.call_id = c.id AND cue.active = true
LEFT JOIN uploads_entry ue ON ue.id = cue.upload_id AND ue.active = true
LEFT JOIN uploads_uploads_connection uuc ON uuc.upload_id = ue.id AND uuc.active = true
LEFT JOIN uploads_resource ur ON ur.id = uuc.uploads_id AND ur.active = true
LEFT JOIN tools_calls_connection tcc ON tcc.call_id = c.id
WHERE c.run_id IS NOT NULL
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX calls_mv_pk
    ON calls_mv (call_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Run ID for filtering
CREATE INDEX calls_mv_run_id_idx
    ON calls_mv (run_id);

-- Upload ID for media resolution
CREATE INDEX calls_mv_uploads_id_idx
    ON calls_mv (uploads_id);

-- Composite: run + created_at (common query pattern)
CREATE INDEX calls_mv_run_created_at_idx
    ON calls_mv (run_id, call_created_at);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW calls_mv;
