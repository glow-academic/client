-- Materialized View: mv_benchmark_eval_summary
-- Eval-level summary for BENCHMARK section - overview page.
--
-- Grain: One row per eval_id
-- Purpose: Fast eval list with pre-computed run counts and status
--
-- This MV is INDEPENDENT - it does not depend on any other MVs.
-- Section: BENCHMARK
-- Source: eval_artifact, eval_runs_junction
--
-- ============================================================================
-- Step 1: Drop all indexes on mv_benchmark_eval_summary materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_benchmark_eval_summary'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_benchmark_eval_summary materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_benchmark_eval_summary CASCADE;

-- ============================================================================
-- Step 3: Create mv_benchmark_eval_summary Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_benchmark_eval_summary AS
WITH
-- Count runs per eval
eval_run_counts AS (
    SELECT
        er.eval_id,
        COUNT(*)::bigint AS total_runs,
        COUNT(*) FILTER (WHERE er.completed = true)::bigint AS completed_runs,
        COUNT(*) FILTER (WHERE er.completed = false)::bigint AS pending_runs
    FROM eval_runs_junction er
    GROUP BY er.eval_id
),
-- Get rubric_id per eval (from run_rubrics or group_rubrics based on use_groups flag)
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
-- Get flags per eval
eval_flags AS (
    SELECT
        ef.eval_id,
        BOOL_OR(CASE WHEN f.name = '' THEN ef.value ELSE false END) AS use_groups,
        BOOL_OR(CASE WHEN f.name = 'dynamic' THEN ef.value ELSE false END) AS dynamic
    FROM eval_flags_junction ef
    JOIN flags_resource f ON f.id = ef.flag_id
    GROUP BY ef.eval_id
),
-- Get eval name_id (active name from junction)
eval_name_ids AS (
    SELECT
        enj.eval_id,
        enj.name_id AS eval_name_id
    FROM eval_names_junction enj
    WHERE enj.active = true
),
-- Get eval description_id (active description from junction)
eval_description_ids AS (
    SELECT
        edj.eval_id,
        edj.description_id AS eval_description_id
    FROM eval_descriptions_junction edj
    WHERE edj.active = true
),
eval_agent_name_ids AS (
    SELECT
        e.id AS eval_id,
        ARRAY[]::uuid[] AS agent_name_ids
    FROM eval_artifact e
)
SELECT
    -- Primary key
    e.id AS eval_id,

    -- Related IDs
    er.rubric_id,
    ARRAY[]::uuid[] AS agent_ids,
    COALESCE(ed.department_ids, ARRAY[]::uuid[]) AS department_ids,

    -- Name/description IDs for hydration
    eni.eval_name_id,
    edi.eval_description_id,
    COALESCE(eani.agent_name_ids, ARRAY[]::uuid[]) AS agent_name_ids,

    -- Timestamps
    e.created_at,
    e.updated_at,

    -- Flags
    COALESCE(ef.use_groups, false) AS use_groups,
    COALESCE(ef.dynamic, false) AS dynamic,

    -- Run counts
    COALESCE(erc.total_runs, 0) AS total_runs,
    COALESCE(erc.completed_runs, 0) AS completed_runs,
    COALESCE(erc.pending_runs, 0) AS pending_runs,

    -- Derived status
    CASE
        WHEN COALESCE(erc.total_runs, 0) = 0 THEN 'pending'
        WHEN COALESCE(erc.pending_runs, 0) > 0 THEN 'running'
        WHEN COALESCE(erc.completed_runs, 0) = COALESCE(erc.total_runs, 0) THEN 'completed'
        ELSE 'pending'
    END AS status

FROM eval_artifact e
LEFT JOIN eval_rubrics er ON er.eval_id = e.id
LEFT JOIN eval_departments ed ON ed.eval_id = e.id
LEFT JOIN eval_flags ef ON ef.eval_id = e.id
LEFT JOIN eval_run_counts erc ON erc.eval_id = e.id
LEFT JOIN eval_name_ids eni ON eni.eval_id = e.id
LEFT JOIN eval_description_ids edi ON edi.eval_id = e.id
LEFT JOIN eval_agent_name_ids eani ON eani.eval_id = e.id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_benchmark_eval_summary_pk
    ON mv_benchmark_eval_summary (eval_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Rubric filtering
CREATE INDEX mv_benchmark_eval_summary_rubric_id_idx
    ON mv_benchmark_eval_summary (rubric_id)
    WHERE rubric_id IS NOT NULL;

-- Status filtering
CREATE INDEX mv_benchmark_eval_summary_status_idx
    ON mv_benchmark_eval_summary (status);

-- Timestamp sorting
CREATE INDEX mv_benchmark_eval_summary_created_at_idx
    ON mv_benchmark_eval_summary (created_at DESC);

CREATE INDEX mv_benchmark_eval_summary_updated_at_idx
    ON mv_benchmark_eval_summary (updated_at DESC);

-- Run count sorting
CREATE INDEX mv_benchmark_eval_summary_total_runs_idx
    ON mv_benchmark_eval_summary (total_runs DESC);

CREATE INDEX mv_benchmark_eval_summary_department_ids_gin
    ON mv_benchmark_eval_summary USING GIN (department_ids);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_benchmark_eval_summary;
