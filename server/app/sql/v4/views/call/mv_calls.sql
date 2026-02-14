-- Materialized View: mv_calls
-- Lean call-level data for group detail pages.
--
-- Grain: One row per call (with run_id)
-- Filter: run_id IS NOT NULL
--
-- Purpose: Exposes tool_id (resource ID) — name resolved in hydration layer
-- Section: CALL (lean MV - used by group detail artifact)
--
-- Dependencies: calls_entry, tools_calls_connection
-- ============================================================================
-- Step 1: Drop all indexes on mv_calls materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_calls'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_calls materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_calls CASCADE;

-- ============================================================================
-- Step 3: Create mv_calls Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_calls AS
SELECT
    c.id AS call_id,
    c.run_id,
    c.created_at AS call_created_at,
    c.arguments_raw,
    tcc.tools_id AS tool_id
FROM calls_entry c
LEFT JOIN tools_calls_connection tcc ON tcc.call_id = c.id
WHERE c.run_id IS NOT NULL
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_calls_pk
    ON mv_calls (call_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Run ID for filtering
CREATE INDEX mv_calls_run_id_idx
    ON mv_calls (run_id);

-- Composite: run + created_at (common query pattern)
CREATE INDEX mv_calls_run_created_at_idx
    ON mv_calls (run_id, call_created_at);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_calls;
