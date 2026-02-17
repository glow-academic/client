-- Materialized View: mv_test
-- Test-level data for benchmark detail views.
--
-- Grain: One row per benchmark test (test_entry.id)
-- Filter: active = TRUE only
--
-- Purpose: Provides test-level resource IDs for parallel fetching.
-- Follows mv_attempt_list pattern: lean, resource-ID-only, no aggregates.
-- All aggregates (total invocations, scores, etc.) derived in service layer
-- from invocations.
--
-- Dependencies: Only uses _entry and _connection tables
-- ============================================================================
-- Step 1: Drop all indexes on mv_test materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_test'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_test materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_test CASCADE;

-- ============================================================================
-- Step 3: Create mv_test Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_test AS
WITH eval_links AS (
    SELECT
        c.attempt_id AS test_id,
        (ARRAY_AGG(c.evals_id ORDER BY c.created_at))[1] AS eval_id
    FROM test_evals_connection c
    WHERE c.active = true
    GROUP BY c.attempt_id
),
profile_links AS (
    SELECT
        c.attempt_id AS test_id,
        (ARRAY_AGG(c.profiles_id ORDER BY c.created_at))[1] AS profile_id
    FROM test_profiles_connection c
    WHERE c.active = true
    GROUP BY c.attempt_id
),
department_links AS (
    SELECT
        c.attempt_id AS test_id,
        ARRAY_AGG(DISTINCT c.departments_id) FILTER (WHERE c.departments_id IS NOT NULL) AS department_ids
    FROM test_departments_connection c
    WHERE c.active = true
    GROUP BY c.attempt_id
)
SELECT
    -- Primary key
    t.id AS test_id,

    -- Resource IDs (from connections for _resource joins at runtime)
    el.eval_id,
    pl.profile_id,
    COALESCE(dl.department_ids, ARRAY[]::uuid[]) AS department_ids,

    -- Flags
    t.infinite_mode,
    COALESCE(ba_archive.archived, false) AS archived,

    -- Timestamp
    t.created_at AS test_created_at

FROM test_entry t
LEFT JOIN eval_links el ON el.test_id = t.id
LEFT JOIN profile_links pl ON pl.test_id = t.id
LEFT JOIN department_links dl ON dl.test_id = t.id
-- Latest archive state (append-only)
LEFT JOIN LATERAL (
    SELECT archived FROM test_archive_entry
    WHERE test_id = t.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
) ba_archive ON true
WHERE t.active = true
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_test_pk
    ON mv_test (test_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Eval ID for filtering
CREATE INDEX mv_test_eval_id_idx
    ON mv_test (eval_id);

-- Profile ID for permission checks and filtering
CREATE INDEX mv_test_profile_id_idx
    ON mv_test (profile_id);

-- Archived flag for filtering
CREATE INDEX mv_test_archived_idx
    ON mv_test (archived);

-- Timestamp for sorting
CREATE INDEX mv_test_created_at_idx
    ON mv_test (test_created_at DESC);

-- Department IDs for filtering
CREATE INDEX mv_test_department_ids_gin
    ON mv_test USING GIN (department_ids);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_test;
