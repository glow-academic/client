-- Materialized View: test_mv
-- Test-level data for benchmark detail views.
--
-- Grain: One row per benchmark test (test_entry.id)
-- Filter: active = TRUE only
--
-- Purpose: Provides test-level resource IDs for parallel fetching.
-- Follows attempt_mv pattern: lean, resource-ID-only, no aggregates.
-- All aggregates (total invocations, scores, etc.) derived in service layer
-- from invocations.
--
-- Dependencies: Only uses _entry and _connection tables
-- ============================================================================
-- Step 1: Drop all indexes on test_mv materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'test_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop test_mv materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS test_mv CASCADE;

-- ============================================================================
-- Step 3: Create test_mv Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW test_mv AS
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
),
benchmark_links AS (
    SELECT
        tbe.test_id,
        (ARRAY_AGG(tbe.benchmark_id ORDER BY tbe.created_at))[1] AS benchmark_id
    FROM test_benchmark_entry tbe
    WHERE tbe.active = true
    GROUP BY tbe.test_id
)
SELECT
    -- Primary key
    t.id AS test_id,

    -- Resource IDs (from connections for _resource joins at runtime)
    el.eval_id,
    pl.profile_id,
    COALESCE(dl.department_ids, ARRAY[]::uuid[]) AS department_ids,

    -- Benchmark link (from bridge table)
    bl.benchmark_id,

    -- Flags
    t.infinite_mode,
    COALESCE(ba_archive.archived, false) AS archived,

    -- Timestamp
    t.created_at AS test_created_at

FROM test_entry t
LEFT JOIN eval_links el ON el.test_id = t.id
LEFT JOIN profile_links pl ON pl.test_id = t.id
LEFT JOIN department_links dl ON dl.test_id = t.id
LEFT JOIN benchmark_links bl ON bl.test_id = t.id
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

CREATE UNIQUE INDEX test_mv_pk
    ON test_mv (test_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Eval ID for filtering
CREATE INDEX test_mv_eval_id_idx
    ON test_mv (eval_id);

-- Profile ID for permission checks and filtering
CREATE INDEX test_mv_profile_id_idx
    ON test_mv (profile_id);

-- Benchmark ID for filtering
CREATE INDEX test_mv_benchmark_id_idx
    ON test_mv (benchmark_id);

-- Archived flag for filtering
CREATE INDEX test_mv_archived_idx
    ON test_mv (archived);

-- Timestamp for sorting
CREATE INDEX test_mv_created_at_idx
    ON test_mv (test_created_at DESC);

-- Department IDs for filtering
CREATE INDEX test_mv_department_ids_gin
    ON test_mv USING GIN (department_ids);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW test_mv;
