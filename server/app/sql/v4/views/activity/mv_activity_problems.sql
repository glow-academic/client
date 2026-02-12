-- Materialized View: mv_activity_problems
-- Problem-level facts for ACTIVITY section.
--
-- Grain: One row per problem_id
-- Purpose: Fast problems list with profile context.
--
-- This MV is INDEPENDENT - it does not depend on any other MVs.
-- Section: ACTIVITY
-- Source: problems_entry + profiles_problems_connection + profile_names_junction + names_resource

-- ============================================================================
-- Step 1: Drop all indexes on mv_activity_problems materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_activity_problems'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_activity_problems materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_activity_problems CASCADE;

-- ============================================================================
-- Step 3: Create mv_activity_problems Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_activity_problems AS
SELECT
    pe.id AS problem_id,
    pe.type::text AS type,
    pe.message,
    pe.resolved,
    pe.created_at,
    pe.updated_at,
    ppj.profiles_id,
    nr.name AS profile_name
FROM problems_entry pe
LEFT JOIN profiles_problems_connection ppj
    ON ppj.problem_id = pe.id
LEFT JOIN profile_names_junction pnj
    ON pnj.profile_id = ppj.profiles_id
   AND pnj.active = true
LEFT JOIN names_resource nr
    ON nr.id = pnj.name_id
   AND nr.active = true
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_activity_problems_pk
    ON mv_activity_problems (problem_id);

-- ============================================================================
-- Step 5: Create Filter Indexes
-- ============================================================================

CREATE INDEX mv_activity_problems_resolved_idx
    ON mv_activity_problems (resolved);

CREATE INDEX mv_activity_problems_created_at_idx
    ON mv_activity_problems (created_at DESC);

CREATE INDEX mv_activity_problems_profile_id_idx
    ON mv_activity_problems (profiles_id)
    WHERE profiles_id IS NOT NULL;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_activity_problems;
