-- Materialized View: mv_reports_cohort
-- Cohort-level aggregation for REPORTS section - cohort performance charts.
--
-- Grain: One row per (profile_id, cohort_id, simulation_id)
-- Purpose: Cohort performance breakdown for individual reports
--
-- This MV is INDEPENDENT - it does not depend on any other MVs.
-- Section: REPORTS
-- Source: simulation_attempts_entry, simulation_chats_entry, simulation_grades_entry, connections
--
-- Filter: is_archived = FALSE
--
-- ============================================================================
-- Step 1: Drop all indexes on mv_reports_cohort materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_reports_cohort'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_reports_cohort materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_reports_cohort CASCADE;

-- ============================================================================
-- Step 3: Create mv_reports_cohort Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_reports_cohort AS
WITH
-- Get attempt to simulation mapping
attempt_simulations AS (
    SELECT
        sas.attempt_id,
        ssj.simulation_id
    FROM simulation_attempts_simulations_connection sas
    JOIN simulation_simulations_junction ssj ON ssj.simulations_id = sas.simulations_id
),
-- Get attempt to profile mapping
attempt_profiles AS (
    SELECT
        sap.attempt_id,
        ppj.profile_id
    FROM simulation_attempts_profiles_connection sap
    JOIN profile_profiles_junction ppj ON ppj.profiles_id = sap.profiles_id
),
-- Get attempt to cohort mapping (unnested to one row per cohort)
attempt_cohorts AS (
    SELECT
        sac.attempt_id,
        ccj.cohort_id
    FROM simulation_attempts_cohorts_connection sac
    JOIN cohort_cohorts_junction ccj ON ccj.cohorts_id = sac.cohorts_id
),
-- Get latest grade per chat
chat_grades AS (
    SELECT DISTINCT ON (g.chat_id)
        g.chat_id,
        g.score,
        g.passed,
        g.time_taken
    FROM simulation_grades_entry g
    ORDER BY g.chat_id, g.created_at DESC
),
-- Aggregate chat data per attempt
attempt_chat_rollup AS (
    SELECT
        c.attempt_id,
        COUNT(*)::int AS chat_count,
        COUNT(*) FILTER (WHERE c.completed = true)::int AS completed_count,
        COUNT(*) FILTER (WHERE cg.passed = true)::int AS passed_count,
        AVG(cg.score) AS avg_score,
        MAX(cg.score) AS max_score,
        SUM(COALESCE(cg.time_taken, 0))::int AS total_time_seconds
    FROM simulation_chats_entry c
    LEFT JOIN chat_grades cg ON cg.chat_id = c.id
    GROUP BY c.attempt_id
)
SELECT
    -- Keys
    ap.profile_id,
    ac.cohort_id,
    asim.simulation_id,

    -- Aggregated counts
    COUNT(DISTINCT a.id)::int AS attempt_count,
    SUM(COALESCE(acr.chat_count, 0))::int AS total_chats,
    SUM(COALESCE(acr.completed_count, 0))::int AS completed_count,
    SUM(COALESCE(acr.passed_count, 0))::int AS passed_count,

    -- Score metrics
    TRUNC(AVG(acr.avg_score)::numeric, 2) AS avg_score,
    MAX(acr.max_score)::int AS max_score,

    -- Pass rate
    CASE
        WHEN SUM(COALESCE(acr.chat_count, 0)) > 0 THEN
            TRUNC((SUM(COALESCE(acr.passed_count, 0))::numeric / SUM(COALESCE(acr.chat_count, 0))) * 100, 2)
        ELSE 0
    END AS pass_rate,

    -- Time metrics
    SUM(COALESCE(acr.total_time_seconds, 0))::int AS total_time_seconds,
    TRUNC(AVG(acr.total_time_seconds)::numeric, 2) AS avg_time_seconds

FROM simulation_attempts_entry a
JOIN attempt_simulations asim ON asim.attempt_id = a.id
JOIN attempt_profiles ap ON ap.attempt_id = a.id
JOIN attempt_cohorts ac ON ac.attempt_id = a.id
LEFT JOIN attempt_chat_rollup acr ON acr.attempt_id = a.id
WHERE a.archived = FALSE
  AND ac.cohort_id IS NOT NULL
GROUP BY ap.profile_id, ac.cohort_id, asim.simulation_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_reports_cohort_pk
    ON mv_reports_cohort (
        COALESCE(profile_id, '00000000-0000-0000-0000-000000000000'::uuid),
        cohort_id,
        COALESCE(simulation_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Profile filtering (primary for reports)
CREATE INDEX mv_reports_cohort_profile_id_idx
    ON mv_reports_cohort (profile_id)
    WHERE profile_id IS NOT NULL;

-- Cohort filtering
CREATE INDEX mv_reports_cohort_cohort_id_idx
    ON mv_reports_cohort (cohort_id);

-- Simulation filtering
CREATE INDEX mv_reports_cohort_simulation_id_idx
    ON mv_reports_cohort (simulation_id)
    WHERE simulation_id IS NOT NULL;

-- Composite: profile + cohort for user cohort performance
CREATE INDEX mv_reports_cohort_profile_cohort_idx
    ON mv_reports_cohort (profile_id, cohort_id)
    WHERE profile_id IS NOT NULL;

-- Composite: profile + simulation for user simulation cohort breakdown
CREATE INDEX mv_reports_cohort_profile_sim_idx
    ON mv_reports_cohort (profile_id, simulation_id)
    WHERE profile_id IS NOT NULL;

-- Score sorting
CREATE INDEX mv_reports_cohort_avg_score_idx
    ON mv_reports_cohort (avg_score DESC);

-- Pass rate sorting
CREATE INDEX mv_reports_cohort_pass_rate_idx
    ON mv_reports_cohort (pass_rate DESC);

-- Attempt count sorting
CREATE INDEX mv_reports_cohort_attempt_count_idx
    ON mv_reports_cohort (attempt_count DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_reports_cohort;
