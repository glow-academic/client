-- Materialized View: mv_problems
-- Lean problem-level data for activity pages.
--
-- Grain: One row per problem
-- Filter: none
--
-- Purpose: Exposes problem data with profile_id — name resolved in hydration layer
-- Section: PROBLEM (lean MV)
--
-- Dependencies: problems_entry, profiles_problems_connection
-- ============================================================================
-- Step 1: Drop all indexes on mv_problems materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_problems'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_problems materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_problems CASCADE;

-- ============================================================================
-- Step 3: Create mv_problems Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_problems AS
SELECT
    pe.id AS problem_id,
    pe.type::text AS type,
    pe.message,
    pe.resolved,
    pe.created_at AS problem_created_at,
    pe.updated_at AS problem_updated_at,
    ppc.profiles_id AS profile_id
FROM problems_entry pe
LEFT JOIN profiles_problems_connection ppc
    ON ppc.problem_id = pe.id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_problems_pk
    ON mv_problems (problem_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX mv_problems_resolved_idx
    ON mv_problems (resolved);

CREATE INDEX mv_problems_created_at_idx
    ON mv_problems (problem_created_at DESC);

CREATE INDEX mv_problems_profile_id_idx
    ON mv_problems (profile_id)
    WHERE profile_id IS NOT NULL;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_problems;
