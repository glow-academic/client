-- Materialized View: mv_dashboard_rubric
-- Pre-aggregates rubric/skill performance metrics for Dashboard.
--
-- Grain: One row per (rubric_id, cohort_id)
-- Purpose: Dashboard skill performance / rubric heatmap
--
-- Source: Aggregates from mv_chat_facts grouped by rubric + cohort
-- Note: For standard group breakdown, join at query time via rubrics_resource.standard_group_ids
-- ============================================================================
-- Step 1: Drop all indexes (if exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_dashboard_rubric'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop materialized view if exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_rubric CASCADE;

-- ============================================================================
-- Step 3: Create Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_dashboard_rubric AS
SELECT
    -- Keys
    rubric_id,
    cohort_id,

    -- Aggregated metrics
    COUNT(*)::int AS attempt_count,
    ROUND(AVG(grade_percent), 2) AS avg_score,
    SUM(rubric_total_points)::int AS total_points,
    SUM(rubric_pass_points)::int AS pass_points

FROM mv_chat_facts
WHERE attempt_type = 'general'
  AND is_archived = FALSE
  AND rubric_id IS NOT NULL
GROUP BY rubric_id, cohort_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_dashboard_rubric_pk
    ON mv_dashboard_rubric (rubric_id, COALESCE(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary access pattern: rubric lookup
CREATE INDEX mv_dashboard_rubric_rubric_id_idx
    ON mv_dashboard_rubric (rubric_id);

-- Cohort filter
CREATE INDEX mv_dashboard_rubric_cohort_id_idx
    ON mv_dashboard_rubric (cohort_id)
    WHERE cohort_id IS NOT NULL;

-- Average score ranking
CREATE INDEX mv_dashboard_rubric_avg_score_idx
    ON mv_dashboard_rubric (avg_score DESC NULLS LAST);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_dashboard_rubric;
