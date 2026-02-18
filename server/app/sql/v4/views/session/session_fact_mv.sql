-- Materialized View: session_fact_mv
-- Grain: One row per profile (most recent session)
-- Filter: active = TRUE only
--
-- Purpose: Provides the most recent session for each profile
-- Dependencies: sessions_entry
-- ============================================================================
-- Step 1: Drop all indexes on session_fact_mv (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'session_fact_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop session_fact_mv materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS session_fact_mv CASCADE;

-- ============================================================================
-- Step 3: Create session_fact_mv Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW session_fact_mv AS
SELECT DISTINCT ON (profile_id)
    id AS session_id,
    profile_id,
    created_at
FROM sessions_entry s
WHERE active = true
ORDER BY profile_id, created_at DESC
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX session_fact_mv_pk
    ON session_fact_mv (profile_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE UNIQUE INDEX session_fact_mv_session_id_idx
    ON session_fact_mv (session_id);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW session_fact_mv;
