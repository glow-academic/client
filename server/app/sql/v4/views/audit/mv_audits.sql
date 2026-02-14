-- Materialized View: mv_audits
-- Lean audit-level data for session detail pages.
--
-- Grain: One row per audit (with session_id)
-- Filter: session_id IS NOT NULL only
--
-- Purpose: Provides audit-level data for parallel fetching
-- Section: AUDIT (lean MV - aggregates computed in Python)
--
-- Dependencies: Only uses _entry tables
-- ============================================================================
-- Step 1: Drop all indexes on mv_audits materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_audits'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_audits materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_audits CASCADE;

-- ============================================================================
-- Step 3: Create mv_audits Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_audits AS
SELECT
    -- Primary key
    a.id AS audit_id,

    -- Session ID
    a.session_id,

    -- Timestamps
    a.created_at AS audit_created_at,

    -- Audit metadata
    a.message,
    a.endpoint,
    a.error

FROM audits_entry a
WHERE a.session_id IS NOT NULL
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_audits_pk
    ON mv_audits (audit_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Session ID for filtering
CREATE INDEX mv_audits_session_id_idx
    ON mv_audits (session_id);

-- Timestamp for sorting
CREATE INDEX mv_audits_created_at_idx
    ON mv_audits (audit_created_at DESC);

-- Composite: session + created_at (common query pattern)
CREATE INDEX mv_audits_session_created_at_idx
    ON mv_audits (session_id, audit_created_at DESC);

-- Error flag (partial - only errors)
CREATE INDEX mv_audits_error_idx
    ON mv_audits (error)
    WHERE error = TRUE;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_audits;
