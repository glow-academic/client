-- Materialized View: mv_reports_profile_metrics
-- Pre-aggregates profile-level metrics for Reports and Leaderboard.
--
-- Grain: One row per (profile_id, attempt_type)
-- Purpose: Reports bundle, Reports overview, Leaderboard
--
-- Source: Aggregates from mv_chat_facts grouped by profile + attempt_type
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
          AND tablename = 'mv_reports_profile_metrics'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop materialized view if exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_reports_profile_metrics CASCADE;

-- ============================================================================
-- Step 3: Create Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_reports_profile_metrics AS
WITH chat_data AS (
    SELECT
        profile_id,
        attempt_type,
        chat_id,
        simulation_id,
        scenario_id,
        cohort_id,
        grade_percent,
        passed,
        completed,
        time_taken,
        num_messages_total,
        message_time_taken_seconds,
        attempt_created_at,
        -- Rank attempts by profile+simulation to identify first attempt
        ROW_NUMBER() OVER (
            PARTITION BY profile_id, simulation_id, attempt_type
            ORDER BY attempt_created_at
        ) AS attempt_rank
    FROM mv_chat_facts
    WHERE is_archived = FALSE
),
-- Calculate improvement rate (compare first vs latest score per simulation)
improvement AS (
    SELECT
        profile_id,
        attempt_type,
        AVG(
            CASE
                WHEN first_score IS NOT NULL AND latest_score IS NOT NULL AND first_score > 0
                THEN ((latest_score - first_score) / first_score) * 100
                ELSE 0
            END
        ) AS improvement_rate
    FROM (
        SELECT
            profile_id,
            attempt_type,
            simulation_id,
            MIN(grade_percent) FILTER (WHERE attempt_rank = 1) AS first_score,
            MAX(grade_percent) AS latest_score
        FROM chat_data
        GROUP BY profile_id, attempt_type, simulation_id
    ) sub
    GROUP BY profile_id, attempt_type
)
SELECT
    -- Keys
    cd.profile_id,
    cd.attempt_type,

    -- The 10 standard metrics
    COUNT(*)::int AS total_attempts,
    ROUND(AVG(cd.grade_percent), 2) AS avg_score,
    MAX(cd.grade_percent) AS highest_score,
    ROUND(
        CASE
            WHEN COUNT(*) > 0
            THEN (COUNT(*) FILTER (WHERE cd.completed = TRUE)::numeric / COUNT(*)) * 100
            ELSE 0
        END,
    2) AS completion_pct,
    ROUND(
        CASE
            WHEN COUNT(*) FILTER (WHERE cd.attempt_rank = 1) > 0
            THEN (COUNT(*) FILTER (WHERE cd.attempt_rank = 1 AND cd.passed = TRUE)::numeric /
                  COUNT(*) FILTER (WHERE cd.attempt_rank = 1)) * 100
            ELSE 0
        END,
    2) AS first_attempt_pass_rate,
    ROUND(AVG(cd.num_messages_total), 2) AS avg_messages_per_session,
    -- Average persona response time (avg of message deltas)
    ROUND(AVG(
        CASE
            WHEN ARRAY_LENGTH(cd.message_time_taken_seconds, 1) > 0
            THEN (
                SELECT AVG(v)::numeric
                FROM unnest(cd.message_time_taken_seconds) AS v
            )
            ELSE NULL
        END
    ), 2) AS avg_persona_response_sec,
    -- Session efficiency: score per minute
    ROUND(
        CASE
            WHEN SUM(cd.time_taken) > 0
            THEN AVG(cd.grade_percent) / (SUM(cd.time_taken)::numeric / 60 / COUNT(*))
            ELSE 0
        END,
    2) AS session_efficiency,
    -- Stagnation rate: % of attempts with no score improvement
    ROUND(
        CASE
            WHEN COUNT(*) > 1
            THEN (COUNT(*) FILTER (
                WHERE cd.grade_percent <= LAG(cd.grade_percent) OVER (
                    PARTITION BY cd.profile_id, cd.attempt_type
                    ORDER BY cd.attempt_created_at
                )
            )::numeric / (COUNT(*) - 1)) * 100
            ELSE 0
        END,
    2) AS stagnation_rate,
    ROUND(SUM(cd.time_taken)::numeric / 60, 2) AS total_time_minutes,

    -- Leaderboard extras
    COALESCE(i.improvement_rate, 0) AS improvement_rate,
    COUNT(*) FILTER (WHERE cd.grade_percent = 100)::int AS perfect_score_count,
    ROUND(MIN(cd.time_taken) FILTER (WHERE cd.passed = TRUE)::numeric / 60, 2) AS quickest_pass_minutes,

    -- Timestamps
    MIN(cd.attempt_created_at) AS first_attempt_at,
    MAX(cd.attempt_created_at) AS last_attempt_at,

    -- Arrays for filtering
    ARRAY_AGG(DISTINCT cd.simulation_id) AS simulation_ids,
    ARRAY_AGG(DISTINCT cd.scenario_id) AS scenario_ids,
    ARRAY_AGG(DISTINCT cd.cohort_id) FILTER (WHERE cd.cohort_id IS NOT NULL) AS cohort_ids

FROM chat_data cd
LEFT JOIN improvement i ON i.profile_id = cd.profile_id AND i.attempt_type = cd.attempt_type
GROUP BY cd.profile_id, cd.attempt_type, i.improvement_rate
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_reports_profile_metrics_pk
    ON mv_reports_profile_metrics (profile_id, attempt_type);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary access pattern: profile lookup
CREATE INDEX mv_reports_profile_metrics_profile_id_idx
    ON mv_reports_profile_metrics (profile_id);

-- Attempt type filter
CREATE INDEX mv_reports_profile_metrics_attempt_type_idx
    ON mv_reports_profile_metrics (attempt_type);

-- Leaderboard rankings
CREATE INDEX mv_reports_profile_metrics_highest_score_idx
    ON mv_reports_profile_metrics (highest_score DESC NULLS LAST);

CREATE INDEX mv_reports_profile_metrics_avg_score_idx
    ON mv_reports_profile_metrics (avg_score DESC NULLS LAST);

CREATE INDEX mv_reports_profile_metrics_total_attempts_idx
    ON mv_reports_profile_metrics (total_attempts DESC);

CREATE INDEX mv_reports_profile_metrics_improvement_rate_idx
    ON mv_reports_profile_metrics (improvement_rate DESC NULLS LAST);

CREATE INDEX mv_reports_profile_metrics_perfect_score_idx
    ON mv_reports_profile_metrics (perfect_score_count DESC)
    WHERE perfect_score_count > 0;

-- GIN indexes for array filtering
CREATE INDEX mv_reports_profile_metrics_simulation_ids_gin
    ON mv_reports_profile_metrics USING GIN (simulation_ids);

CREATE INDEX mv_reports_profile_metrics_scenario_ids_gin
    ON mv_reports_profile_metrics USING GIN (scenario_ids);

CREATE INDEX mv_reports_profile_metrics_cohort_ids_gin
    ON mv_reports_profile_metrics USING GIN (cohort_ids);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_reports_profile_metrics;
