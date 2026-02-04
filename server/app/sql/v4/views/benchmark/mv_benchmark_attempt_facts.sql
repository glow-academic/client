-- Materialized View: mv_benchmark_attempt_facts
-- Attempt-level facts for BENCHMARK section - history page.
--
-- Grain: One row per attempt_id
-- Purpose: Fast paginated list of benchmark attempts with eval info and status
--
-- This MV is INDEPENDENT - it does not depend on any other MVs.
-- Section: BENCHMARK
-- Source: view_benchmark_tests_entry, benchmark_tests_evals_connection, eval_runs_junction, view_tests_entry
--
-- ============================================================================
-- Step 1: Drop all indexes on mv_benchmark_attempt_facts materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_benchmark_attempt_facts'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_benchmark_attempt_facts materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_benchmark_attempt_facts CASCADE;

-- ============================================================================
-- Step 3: Create mv_benchmark_attempt_facts Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_benchmark_attempt_facts AS
WITH
-- Get rubric_id per eval (from run_rubrics or group_rubrics)
eval_rubrics AS (
    SELECT DISTINCT ON (e.id)
        e.id AS eval_id,
        COALESCE(rr.rubric_id, gr.rubric_id) AS rubric_id
    FROM eval_artifact e
    LEFT JOIN eval_runs_rubrics_junction err ON err.eval_id = e.id
    LEFT JOIN run_rubrics_resource rr ON rr.id = err.run_rubric_id
    LEFT JOIN eval_groups_rubrics_junction egr ON egr.eval_id = e.id
    LEFT JOIN group_rubrics_resource gr ON gr.id = egr.group_rubric_id
    ORDER BY e.id, COALESCE(err.created_at, egr.created_at) ASC
),
-- Get department_ids per eval (via rubric)
eval_departments AS (
    SELECT
        er.eval_id,
        ARRAY_AGG(DISTINCT rd.department_id) FILTER (WHERE rd.department_id IS NOT NULL) AS department_ids
    FROM eval_rubrics er
    JOIN rubric_departments_junction rd ON rd.rubric_id = er.rubric_id AND rd.active = true
    GROUP BY er.eval_id
),
-- Count total runs per eval
eval_run_counts AS (
    SELECT
        er.eval_id,
        COUNT(*)::bigint AS total_runs,
        ARRAY_AGG(er.run_id) AS run_ids
    FROM eval_runs_junction er
    GROUP BY er.eval_id
),
-- Count completed tests per attempt (tests with trace_id pattern: eval_{attempt_id}_{run_id})
attempt_test_counts AS (
    SELECT
        t.attempt_id,
        COUNT(*) FILTER (WHERE t.completed = true)::bigint AS completed_tests
    FROM view_tests_entry t
    WHERE t.trace_id LIKE 'eval_%'
    GROUP BY t.attempt_id
)
SELECT
    -- Primary key
    ba.id AS attempt_id,

    -- Eval info
    bae.evals_id AS eval_id,
    er.rubric_id,

    -- Department IDs for access control
    COALESCE(ed.department_ids, ARRAY[]::uuid[]) AS department_ids,

    -- Timestamps
    ba.created_at AS attempt_created_at,

    -- Flags
    COALESCE(ba.archived, false) AS archived,

    -- Run counts
    COALESCE(erc.total_runs, 0) AS total_runs,
    COALESCE(atc.completed_tests, 0) AS completed_runs,
    GREATEST(0, COALESCE(erc.total_runs, 0) - COALESCE(atc.completed_tests, 0)) AS pending_runs,

    -- Derived status
    CASE
        WHEN COALESCE(erc.total_runs, 0) = 0 THEN 'pending'
        WHEN COALESCE(atc.completed_tests, 0) < COALESCE(erc.total_runs, 0) THEN 'running'
        WHEN COALESCE(atc.completed_tests, 0) >= COALESCE(erc.total_runs, 0) AND COALESCE(erc.total_runs, 0) > 0 THEN 'completed'
        ELSE 'pending'
    END AS status

FROM view_benchmark_tests_entry ba
JOIN benchmark_tests_evals_connection bae ON bae.attempt_id = ba.id
LEFT JOIN eval_rubrics er ON er.eval_id = bae.evals_id
LEFT JOIN eval_departments ed ON ed.eval_id = bae.evals_id
LEFT JOIN eval_run_counts erc ON erc.eval_id = bae.evals_id
LEFT JOIN attempt_test_counts atc ON atc.attempt_id = ba.id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_benchmark_attempt_facts_pk
    ON mv_benchmark_attempt_facts (attempt_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Eval filtering
CREATE INDEX mv_benchmark_attempt_facts_eval_id_idx
    ON mv_benchmark_attempt_facts (eval_id);

-- Rubric filtering
CREATE INDEX mv_benchmark_attempt_facts_rubric_id_idx
    ON mv_benchmark_attempt_facts (rubric_id)
    WHERE rubric_id IS NOT NULL;

-- Status filtering
CREATE INDEX mv_benchmark_attempt_facts_status_idx
    ON mv_benchmark_attempt_facts (status);

-- Archived filtering
CREATE INDEX mv_benchmark_attempt_facts_archived_idx
    ON mv_benchmark_attempt_facts (archived);

-- Timestamp sorting
CREATE INDEX mv_benchmark_attempt_facts_created_at_idx
    ON mv_benchmark_attempt_facts (attempt_created_at DESC);

-- Composite: eval + created for eval-specific history
CREATE INDEX mv_benchmark_attempt_facts_eval_created_idx
    ON mv_benchmark_attempt_facts (eval_id, attempt_created_at DESC);

-- Composite: status + created for status filtering with sort
CREATE INDEX mv_benchmark_attempt_facts_status_created_idx
    ON mv_benchmark_attempt_facts (status, attempt_created_at DESC);

-- GIN index for department array filtering
CREATE INDEX mv_benchmark_attempt_facts_department_ids_gin
    ON mv_benchmark_attempt_facts USING GIN (department_ids);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_benchmark_attempt_facts;
