-- Materialized View: mv_reports_profile_metrics
-- Profile metrics aggregation for REPORTS section - reports bundle, leaderboard rankings.
--
-- Grain: One row per (profile_id, attempt_type)
-- Purpose: Reports bundle, leaderboard rankings
--
-- Section: REPORTS
-- Source: Aggregate from mv_reports_chat_facts grouped by profile + attempt_type
--
-- ============================================================================
-- Step 1: Drop all indexes on mv_reports_profile_metrics materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_reports_profile_metrics'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_reports_profile_metrics materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_reports_profile_metrics CASCADE;

-- ============================================================================
-- Step 3: Create mv_reports_profile_metrics Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_reports_profile_metrics AS
WITH
-- First attempt per profile/simulation for first_attempt_pass_rate
first_attempts AS (
    SELECT DISTINCT ON (profile_id, simulation_id, attempt_type)
        profile_id,
        simulation_id,
        attempt_type,
        attempt_id,
        passed
    FROM mv_reports_chat_facts
    ORDER BY profile_id, simulation_id, attempt_type, attempt_created_at ASC
),
-- Scores per attempt for improvement tracking
attempt_scores AS (
    SELECT
        profile_id,
        attempt_type,
        attempt_id,
        attempt_created_at,
        AVG(grade_percent) AS attempt_score
    FROM mv_reports_chat_facts
    WHERE grade_percent IS NOT NULL
    GROUP BY profile_id, attempt_type, attempt_id, attempt_created_at
),
-- Improvement rate: compare first half vs second half of attempts
improvement_calc AS (
    SELECT
        profile_id,
        attempt_type,
        TRUNC(
            AVG(CASE WHEN rn > cnt/2 THEN attempt_score ELSE NULL END) -
            AVG(CASE WHEN rn <= cnt/2 THEN attempt_score ELSE NULL END),
            2
        ) AS improvement_rate
    FROM (
        SELECT
            profile_id,
            attempt_type,
            attempt_score,
            ROW_NUMBER() OVER (PARTITION BY profile_id, attempt_type ORDER BY attempt_created_at) AS rn,
            COUNT(*) OVER (PARTITION BY profile_id, attempt_type) AS cnt
        FROM attempt_scores
    ) sub
    WHERE cnt >= 2
    GROUP BY profile_id, attempt_type
),
-- Quickest pass time per profile
quickest_pass AS (
    SELECT
        profile_id,
        attempt_type,
        TRUNC(MIN(time_taken) / 60.0, 2) AS quickest_pass_minutes
    FROM mv_reports_chat_facts
    WHERE passed = TRUE AND time_taken > 0
    GROUP BY profile_id, attempt_type
)
SELECT
    -- Keys
    cf.profile_id,
    cf.attempt_type,

    -- Standard metrics
    COUNT(DISTINCT cf.attempt_id)::int AS total_attempts,
    TRUNC(AVG(cf.grade_percent), 2) AS avg_score,
    MAX(cf.grade_percent) AS highest_score,
    TRUNC(
        (COUNT(*) FILTER (WHERE cf.completed = TRUE)::numeric / NULLIF(COUNT(*), 0)) * 100.0,
        2
    ) AS completion_pct,
    -- First attempt pass rate
    TRUNC(
        (COUNT(DISTINCT fa.attempt_id) FILTER (WHERE fa.passed = TRUE)::numeric /
         NULLIF(COUNT(DISTINCT fa.attempt_id), 0)) * 100.0,
        2
    ) AS first_attempt_pass_rate,
    TRUNC(AVG(cf.num_messages_total), 2) AS avg_messages_per_session,
    -- Average persona response time
    TRUNC(
        AVG(
            CASE
                WHEN CARDINALITY(cf.message_time_taken_seconds) > 0
                THEN (SELECT AVG(t)::numeric FROM UNNEST(cf.message_time_taken_seconds) AS t)
                ELSE NULL
            END
        ),
        2
    ) AS avg_persona_response_sec,
    -- Session efficiency: score per message
    TRUNC(
        AVG(cf.grade_percent) / NULLIF(AVG(cf.num_messages_total), 0),
        2
    ) AS session_efficiency,
    -- Stagnation rate: % of attempts with no improvement from previous
    NULL::numeric(5,2) AS stagnation_rate,  -- Complex calculation, deferred to query time
    TRUNC(SUM(COALESCE(cf.time_taken, 0)) / 60.0, 2) AS total_time_minutes,

    -- Leaderboard extras
    ic.improvement_rate,
    COUNT(*) FILTER (WHERE cf.grade_percent = 100)::int AS perfect_score_count,
    qp.quickest_pass_minutes,

    -- Timestamps
    MIN(cf.attempt_created_at) AS first_attempt_at,
    MAX(cf.attempt_created_at) AS last_attempt_at,

    -- Arrays for filtering (IDs only)
    ARRAY_AGG(DISTINCT cf.simulation_id) AS simulation_ids,
    ARRAY_AGG(DISTINCT cf.scenario_id) FILTER (WHERE cf.scenario_id IS NOT NULL) AS scenario_ids,
    ARRAY_AGG(DISTINCT cf.cohort_id) FILTER (WHERE cf.cohort_id IS NOT NULL) AS cohort_ids

FROM mv_reports_chat_facts cf
LEFT JOIN first_attempts fa ON fa.profile_id = cf.profile_id
    AND fa.simulation_id = cf.simulation_id
    AND fa.attempt_type = cf.attempt_type
LEFT JOIN improvement_calc ic ON ic.profile_id = cf.profile_id
    AND ic.attempt_type = cf.attempt_type
LEFT JOIN quickest_pass qp ON qp.profile_id = cf.profile_id
    AND qp.attempt_type = cf.attempt_type
GROUP BY cf.profile_id, cf.attempt_type, ic.improvement_rate, qp.quickest_pass_minutes
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_reports_profile_metrics_pk
    ON mv_reports_profile_metrics (profile_id, attempt_type);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary lookup: profile
CREATE INDEX mv_reports_profile_metrics_profile_id_idx
    ON mv_reports_profile_metrics (profile_id);

-- Attempt type filtering
CREATE INDEX mv_reports_profile_metrics_attempt_type_idx
    ON mv_reports_profile_metrics (attempt_type);

-- Leaderboard sorting: avg_score
CREATE INDEX mv_reports_profile_metrics_avg_score_idx
    ON mv_reports_profile_metrics (avg_score DESC NULLS LAST)
    WHERE avg_score IS NOT NULL;

-- Leaderboard sorting: highest_score
CREATE INDEX mv_reports_profile_metrics_highest_score_idx
    ON mv_reports_profile_metrics (highest_score DESC NULLS LAST)
    WHERE highest_score IS NOT NULL;

-- Leaderboard sorting: total_attempts
CREATE INDEX mv_reports_profile_metrics_total_attempts_idx
    ON mv_reports_profile_metrics (total_attempts DESC);

-- Leaderboard sorting: completion_pct
CREATE INDEX mv_reports_profile_metrics_completion_pct_idx
    ON mv_reports_profile_metrics (completion_pct DESC NULLS LAST)
    WHERE completion_pct IS NOT NULL;

-- Leaderboard sorting: first_attempt_pass_rate
CREATE INDEX mv_reports_profile_metrics_first_pass_rate_idx
    ON mv_reports_profile_metrics (first_attempt_pass_rate DESC NULLS LAST)
    WHERE first_attempt_pass_rate IS NOT NULL;

-- Leaderboard sorting: improvement_rate
CREATE INDEX mv_reports_profile_metrics_improvement_rate_idx
    ON mv_reports_profile_metrics (improvement_rate DESC NULLS LAST)
    WHERE improvement_rate IS NOT NULL;

-- Leaderboard sorting: perfect_score_count
CREATE INDEX mv_reports_profile_metrics_perfect_count_idx
    ON mv_reports_profile_metrics (perfect_score_count DESC)
    WHERE perfect_score_count > 0;

-- Leaderboard sorting: quickest_pass_minutes (ASC - lower is better)
CREATE INDEX mv_reports_profile_metrics_quickest_pass_idx
    ON mv_reports_profile_metrics (quickest_pass_minutes ASC NULLS LAST)
    WHERE quickest_pass_minutes IS NOT NULL;

-- Time-based sorting
CREATE INDEX mv_reports_profile_metrics_last_attempt_idx
    ON mv_reports_profile_metrics (last_attempt_at DESC);

-- GIN indexes for array filtering
CREATE INDEX mv_reports_profile_metrics_simulation_ids_gin
    ON mv_reports_profile_metrics USING GIN (simulation_ids);

CREATE INDEX mv_reports_profile_metrics_cohort_ids_gin
    ON mv_reports_profile_metrics USING GIN (cohort_ids);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_reports_profile_metrics;
