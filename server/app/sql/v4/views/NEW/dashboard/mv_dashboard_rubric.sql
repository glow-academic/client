-- Materialized View: mv_dashboard_rubric
-- Skill/Rubric performance aggregation for DASHBOARD section.
--
-- Grain: One row per (rubric_id, cohort_id)
-- Purpose: Rubric heatmap, skill performance
--
-- Section: DASHBOARD
-- Source: Aggregate from mv_dashboard_chat_facts WHERE rubric_id IS NOT NULL
--
-- ============================================================================
-- Step 1: Drop all indexes on mv_dashboard_rubric materialized view (if it exists)
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
-- Step 2: Drop mv_dashboard_rubric materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_rubric CASCADE;

-- ============================================================================
-- Step 3: Create mv_dashboard_rubric Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_dashboard_rubric AS
SELECT
    -- Keys
    rubric_id,
    cohort_id,

    -- Aggregated metrics
    COUNT(DISTINCT attempt_id)::int AS attempt_count,
    TRUNC(AVG(grade_percent), 2) AS avg_score,
    SUM(rubric_total_points)::int AS total_points,
    SUM(rubric_pass_points)::int AS pass_points

FROM mv_dashboard_chat_facts
WHERE rubric_id IS NOT NULL
  AND is_archived = FALSE  -- Exclude archived
GROUP BY rubric_id, cohort_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_dashboard_rubric_pk
    ON mv_dashboard_rubric (
        rubric_id,
        COALESCE(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary lookup: rubric
CREATE INDEX mv_dashboard_rubric_rubric_id_idx
    ON mv_dashboard_rubric (rubric_id);

-- Cohort filtering
CREATE INDEX mv_dashboard_rubric_cohort_id_idx
    ON mv_dashboard_rubric (cohort_id)
    WHERE cohort_id IS NOT NULL;

-- Score-based sorting for heatmaps
CREATE INDEX mv_dashboard_rubric_avg_score_idx
    ON mv_dashboard_rubric (avg_score DESC NULLS LAST)
    WHERE avg_score IS NOT NULL;

-- Attempt count sorting
CREATE INDEX mv_dashboard_rubric_attempt_count_idx
    ON mv_dashboard_rubric (attempt_count DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_dashboard_rubric;
