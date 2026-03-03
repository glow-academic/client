-- Materialized View: problems_mv
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
-- Step 1: Drop all indexes on problems_mv materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'problems_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop problems_mv materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS problems_mv CASCADE;

-- ============================================================================
-- Step 3: Create problems_mv Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW problems_mv AS
SELECT
    pe.id AS problem_id,
    pe.type::text AS type,
    pe.message,
    COALESCE(re.resolved, FALSE) AS resolved,
    pe.session_id,
    pe.created_at AS problem_created_at,
    pe.updated_at AS problem_updated_at,
    ppc.profiles_id AS profile_id
FROM problems_entry pe
LEFT JOIN profiles_problems_connection ppc
    ON ppc.problem_id = pe.id
-- Latest resolved state (append-only)
LEFT JOIN LATERAL (
    SELECT resolved FROM resolves_entry
    WHERE problem_id = pe.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
) re ON true
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX problems_mv_pk
    ON problems_mv (problem_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX problems_mv_resolved_idx
    ON problems_mv (resolved);

CREATE INDEX problems_mv_created_at_idx
    ON problems_mv (problem_created_at DESC);

CREATE INDEX problems_mv_session_id_idx
    ON problems_mv (session_id);

CREATE INDEX problems_mv_profile_id_idx
    ON problems_mv (profile_id)
    WHERE profile_id IS NOT NULL;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW problems_mv;
