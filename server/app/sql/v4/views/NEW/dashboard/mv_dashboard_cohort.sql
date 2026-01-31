-- Materialized View: mv_dashboard_cohort
-- Cohort performance aggregation for DASHBOARD section.
--
-- Grain: One row per (cohort_id, simulation_id)
-- Purpose: Cohort performance comparison
--
-- Section: DASHBOARD
-- Source: Aggregate from mv_dashboard_chat_facts WHERE cohort_id IS NOT NULL
--
-- ============================================================================
-- Step 1: Drop all indexes on mv_dashboard_cohort materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_dashboard_cohort'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_dashboard_cohort materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_cohort CASCADE;

-- ============================================================================
-- Step 3: Create mv_dashboard_cohort Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_dashboard_cohort AS
SELECT
    -- Keys
    cohort_id,
    simulation_id,

    -- Aggregated metrics
    COUNT(DISTINCT profile_id)::int AS total_profiles,
    COUNT(DISTINCT attempt_id)::int AS attempt_count,
    COUNT(*) FILTER (WHERE passed = TRUE)::int AS passed_count,
    TRUNC(AVG(grade_percent), 2) AS avg_score,
    TRUNC(
        (COUNT(*) FILTER (WHERE passed = TRUE)::numeric / NULLIF(COUNT(*), 0)) * 100.0,
        2
    ) AS pass_rate

FROM mv_dashboard_chat_facts
WHERE cohort_id IS NOT NULL
  AND is_archived = FALSE  -- Exclude archived
GROUP BY cohort_id, simulation_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_dashboard_cohort_pk
    ON mv_dashboard_cohort (cohort_id, simulation_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary lookup: cohort
CREATE INDEX mv_dashboard_cohort_cohort_id_idx
    ON mv_dashboard_cohort (cohort_id);

-- Simulation filtering
CREATE INDEX mv_dashboard_cohort_simulation_id_idx
    ON mv_dashboard_cohort (simulation_id);

-- Score-based sorting for leaderboards
CREATE INDEX mv_dashboard_cohort_avg_score_idx
    ON mv_dashboard_cohort (avg_score DESC NULLS LAST)
    WHERE avg_score IS NOT NULL;

-- Pass rate sorting
CREATE INDEX mv_dashboard_cohort_pass_rate_idx
    ON mv_dashboard_cohort (pass_rate DESC NULLS LAST)
    WHERE pass_rate IS NOT NULL;

-- Attempt count sorting
CREATE INDEX mv_dashboard_cohort_attempt_count_idx
    ON mv_dashboard_cohort (attempt_count DESC);

-- Profile count sorting
CREATE INDEX mv_dashboard_cohort_total_profiles_idx
    ON mv_dashboard_cohort (total_profiles DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_dashboard_cohort;
