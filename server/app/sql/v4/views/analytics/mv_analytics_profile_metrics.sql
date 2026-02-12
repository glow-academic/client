-- Materialized View: mv_profile_metrics
-- Profile-level aggregates for leaderboards, reports bundle, and certificates.
--
-- Grain: One row per (profile_id, attempt_type, is_archived)
-- Filter: None at MV level - all data included (filtering done at query time)
--
-- Purpose: Profile-level aggregates for Reports leaderboards and profile cards
-- Section: ANALYTICS (self-contained, no MV dependencies)
--
-- Dependencies: Uses entry tables only
-- ============================================================================
-- Step 1: Drop all indexes on mv_profile_metrics materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_profile_metrics'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_profile_metrics materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_profile_metrics CASCADE;

-- ============================================================================
-- Step 3: Create mv_profile_metrics Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_profile_metrics AS
WITH
latest_grade AS (
    SELECT DISTINCT ON (g.chat_id)
        g.chat_id,
        g.score,
        g.passed,
        g.time_taken,
        g.total_points AS rubric_total_points
    FROM simulation_grades_entry g
    WHERE g.active = TRUE
    ORDER BY g.chat_id, g.created_at DESC
),
message_stats AS (
    SELECT
        sm.chat_id,
        COUNT(*)::int AS num_messages_total,
        ARRAY_AGG(
            EXTRACT(EPOCH FROM (sm.updated_at - sm.created_at))::int
            ORDER BY sm.created_at
        ) FILTER (WHERE m.role = 'assistant'::message_type) AS message_time_taken_seconds
    FROM simulation_messages_entry sm
    JOIN messages_entry m ON m.id = sm.id
    WHERE m.active = TRUE
      AND m.role IN ('user'::message_type, 'assistant'::message_type)
    GROUP BY sm.chat_id
),
chat_scope AS (
    SELECT
        c.id AS chat_id,
        (ARRAY_AGG(tsc.scenarios_id ORDER BY tsc.created_at) FILTER (WHERE tsc.scenarios_id IS NOT NULL))[1] AS scenario_id
    FROM simulation_chats_entry c
    JOIN simulation_attempts_entry a ON a.id = c.attempt_id
    LEFT JOIN training_bundle_departments_entry tbd ON tbd.id = c.training_bundle_department_id AND tbd.active = TRUE
    LEFT JOIN training_bundle_departments_scenarios_connection tsc ON tsc.training_bundle_department_id = tbd.id AND tsc.active = TRUE
    WHERE c.active = TRUE
      AND a.active = TRUE
    GROUP BY c.id
),
chat_facts AS (
    SELECT
        c.id AS chat_id,
        c.attempt_id,
        asc_conn.simulations_id AS simulation_id,
        apc.profiles_id AS profile_id,
        acc.cohorts_id AS cohort_id,
        a.created_at AS attempt_created_at,
        CASE WHEN COALESCE(a.practice, FALSE) THEN 'practice' ELSE 'general' END AS attempt_type,
        COALESCE(a.archived, FALSE) AS is_archived,
        (EXISTS (SELECT 1 FROM simulation_completions_entry comp WHERE comp.chat_id = c.id AND comp.active = TRUE)) AS completed,
        cs.scenario_id,
        lg.passed,
        lg.time_taken,
        CASE
            WHEN lg.rubric_total_points IS NOT NULL AND lg.rubric_total_points > 0
            THEN ROUND((lg.score::numeric / lg.rubric_total_points::numeric) * 100, 2)
            ELSE NULL
        END AS grade_percent,
        COALESCE(ms.num_messages_total, 0) AS num_messages_total,
        COALESCE(ms.message_time_taken_seconds, ARRAY[]::int[]) AS message_time_taken_seconds
    FROM simulation_chats_entry c
    JOIN simulation_attempts_entry a ON a.id = c.attempt_id
    JOIN simulation_attempts_simulations_connection asc_conn ON asc_conn.attempt_id = a.id
    JOIN simulation_attempts_profiles_connection apc ON apc.attempt_id = a.id
    LEFT JOIN simulation_attempts_cohorts_connection acc ON acc.attempt_id = a.id
    JOIN chat_scope cs ON cs.chat_id = c.id
    LEFT JOIN latest_grade lg ON lg.chat_id = c.id
    LEFT JOIN message_stats ms ON ms.chat_id = c.id
    WHERE c.active = TRUE
      AND a.active = TRUE
),
-- First attempt per profile (for first_attempt_pass_rate)
first_attempts AS (
    SELECT DISTINCT ON (cf.profile_id, cf.attempt_type, cf.is_archived)
        cf.profile_id,
        cf.attempt_type,
        cf.is_archived,
        cf.passed AS first_attempt_passed
    FROM chat_facts cf
    WHERE cf.completed = TRUE
    ORDER BY cf.profile_id, cf.attempt_type, cf.is_archived, cf.attempt_created_at
),
-- Quickest passing attempt per profile
quickest_pass AS (
    SELECT DISTINCT ON (cf.profile_id, cf.attempt_type, cf.is_archived)
        cf.profile_id,
        cf.attempt_type,
        cf.is_archived,
        cf.time_taken AS quickest_pass_seconds
    FROM chat_facts cf
    WHERE cf.passed = TRUE
      AND cf.time_taken IS NOT NULL
      AND cf.time_taken > 0
    ORDER BY cf.profile_id, cf.attempt_type, cf.is_archived, cf.time_taken
),
-- Base metrics aggregation
base_metrics AS (
    SELECT
        cf.profile_id,
        cf.attempt_type,
        cf.is_archived,

        -- Standard metrics
        COUNT(DISTINCT cf.attempt_id)::int AS total_attempts,
        ROUND(AVG(cf.grade_percent) FILTER (WHERE cf.grade_percent IS NOT NULL), 2) AS avg_score,
        MAX(cf.grade_percent) AS highest_score,
        ROUND(
            (COUNT(*) FILTER (WHERE cf.completed = TRUE)::numeric /
             NULLIF(COUNT(*)::numeric, 0)) * 100,
            2
        ) AS completion_pct,
        ROUND(AVG(cf.num_messages_total)::numeric, 2) AS avg_messages_per_session,

        -- Average persona response time (from message_time_taken_seconds array)
        ROUND(
            AVG(
                (SELECT AVG(t) FROM unnest(cf.message_time_taken_seconds) AS t)
            ) FILTER (WHERE array_length(cf.message_time_taken_seconds, 1) > 0),
            2
        ) AS avg_persona_response_sec,

        -- Total time in minutes
        ROUND(
            COALESCE(SUM(cf.time_taken) FILTER (WHERE cf.time_taken IS NOT NULL), 0)::numeric / 60,
            2
        ) AS total_time_minutes,

        -- Leaderboard extras
        COUNT(*) FILTER (WHERE cf.grade_percent = 100)::int AS perfect_score_count,

        -- Timestamps
        MIN(cf.attempt_created_at) AS first_attempt_at,
        MAX(cf.attempt_created_at) AS last_attempt_at,

        -- Arrays for filtering
        ARRAY_AGG(DISTINCT cf.simulation_id ORDER BY cf.simulation_id) AS simulation_ids,
        ARRAY_AGG(DISTINCT cf.scenario_id ORDER BY cf.scenario_id) AS scenario_ids,
        ARRAY_AGG(DISTINCT cf.cohort_id ORDER BY cf.cohort_id) FILTER (WHERE cf.cohort_id IS NOT NULL) AS cohort_ids

    FROM chat_facts cf
    GROUP BY
        cf.profile_id,
        cf.attempt_type,
        cf.is_archived
),
-- Calculate improvement rate (comparing first half vs second half of attempts)
improvement_calc AS (
    SELECT
        profile_id,
        attempt_type,
        is_archived,
        ROUND(
            AVG(CASE WHEN rn > cnt / 2 THEN grade_percent ELSE NULL END) -
            AVG(CASE WHEN rn <= cnt / 2 THEN grade_percent ELSE NULL END),
            2
        ) AS improvement_rate
    FROM (
        SELECT
            cf.profile_id,
            cf.attempt_type,
            cf.is_archived,
            cf.grade_percent,
            ROW_NUMBER() OVER (
                PARTITION BY cf.profile_id, cf.attempt_type, cf.is_archived
                ORDER BY cf.attempt_created_at
            ) AS rn,
            COUNT(*) OVER (
                PARTITION BY cf.profile_id, cf.attempt_type, cf.is_archived
            ) AS cnt
        FROM chat_facts cf
        WHERE cf.grade_percent IS NOT NULL
    ) ranked
    WHERE cnt >= 2
    GROUP BY profile_id, attempt_type, is_archived
),
-- Calculate session efficiency (score per minute)
efficiency_calc AS (
    SELECT
        cf.profile_id,
        cf.attempt_type,
        cf.is_archived,
        ROUND(
            AVG(
                CASE
                    WHEN cf.time_taken > 0 AND cf.grade_percent IS NOT NULL
                    THEN cf.grade_percent / (cf.time_taken / 60.0)
                    ELSE NULL
                END
            ),
            2
        ) AS session_efficiency
    FROM chat_facts cf
    WHERE cf.time_taken > 0
    GROUP BY cf.profile_id, cf.attempt_type, cf.is_archived
)
SELECT
    -- Keys
    bm.profile_id,
    bm.attempt_type,
    bm.is_archived,

    -- Standard metrics
    bm.total_attempts,
    bm.avg_score,
    bm.highest_score,
    bm.completion_pct,
    CASE
        WHEN fa.first_attempt_passed = TRUE THEN 100.0
        WHEN fa.first_attempt_passed = FALSE THEN 0.0
        ELSE NULL
    END AS first_attempt_pass_rate,
    bm.avg_messages_per_session,
    bm.avg_persona_response_sec,
    ec.session_efficiency,
    bm.total_time_minutes,

    -- Leaderboard extras
    COALESCE(ic.improvement_rate, 0) AS improvement_rate,
    bm.perfect_score_count,
    ROUND(qp.quickest_pass_seconds::numeric / 60, 2) AS quickest_pass_minutes,

    -- Timestamps
    bm.first_attempt_at,
    bm.last_attempt_at,

    -- Arrays for filtering
    bm.simulation_ids,
    bm.scenario_ids,
    bm.cohort_ids

FROM base_metrics bm
LEFT JOIN first_attempts fa ON fa.profile_id = bm.profile_id
    AND fa.attempt_type = bm.attempt_type
    AND fa.is_archived = bm.is_archived
LEFT JOIN quickest_pass qp ON qp.profile_id = bm.profile_id
    AND qp.attempt_type = bm.attempt_type
    AND qp.is_archived = bm.is_archived
LEFT JOIN improvement_calc ic ON ic.profile_id = bm.profile_id
    AND ic.attempt_type = bm.attempt_type
    AND ic.is_archived = bm.is_archived
LEFT JOIN efficiency_calc ec ON ec.profile_id = bm.profile_id
    AND ec.attempt_type = bm.attempt_type
    AND ec.is_archived = bm.is_archived
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_profile_metrics_pk
    ON mv_profile_metrics (profile_id, attempt_type, is_archived);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Profile lookup
CREATE INDEX mv_profile_metrics_profile_id_idx
    ON mv_profile_metrics (profile_id);

-- Flag indexes
CREATE INDEX mv_profile_metrics_attempt_type_idx
    ON mv_profile_metrics (attempt_type);

CREATE INDEX mv_profile_metrics_is_archived_idx
    ON mv_profile_metrics (is_archived);

-- Leaderboard sorting indexes
CREATE INDEX mv_profile_metrics_avg_score_desc_idx
    ON mv_profile_metrics (avg_score DESC NULLS LAST);

CREATE INDEX mv_profile_metrics_highest_score_desc_idx
    ON mv_profile_metrics (highest_score DESC NULLS LAST);

CREATE INDEX mv_profile_metrics_completion_pct_desc_idx
    ON mv_profile_metrics (completion_pct DESC NULLS LAST);

CREATE INDEX mv_profile_metrics_total_attempts_desc_idx
    ON mv_profile_metrics (total_attempts DESC);

CREATE INDEX mv_profile_metrics_improvement_rate_desc_idx
    ON mv_profile_metrics (improvement_rate DESC NULLS LAST);

CREATE INDEX mv_profile_metrics_perfect_score_desc_idx
    ON mv_profile_metrics (perfect_score_count DESC);

CREATE INDEX mv_profile_metrics_quickest_pass_idx
    ON mv_profile_metrics (quickest_pass_minutes ASC NULLS LAST);

-- GIN indexes on array columns for filtering
CREATE INDEX mv_profile_metrics_simulation_ids_gin_idx
    ON mv_profile_metrics USING GIN (simulation_ids);

CREATE INDEX mv_profile_metrics_scenario_ids_gin_idx
    ON mv_profile_metrics USING GIN (scenario_ids);

CREATE INDEX mv_profile_metrics_cohort_ids_gin_idx
    ON mv_profile_metrics USING GIN (cohort_ids)
    WHERE cohort_ids IS NOT NULL;

-- Partial index for non-archived (most common query)
CREATE INDEX mv_profile_metrics_not_archived_idx
    ON mv_profile_metrics (attempt_type, avg_score DESC NULLS LAST)
    WHERE is_archived = FALSE;

-- Leaderboard with type filter (non-archived)
CREATE INDEX mv_profile_metrics_leaderboard_general_idx
    ON mv_profile_metrics (avg_score DESC NULLS LAST, profile_id)
    WHERE is_archived = FALSE AND attempt_type = 'general';

CREATE INDEX mv_profile_metrics_leaderboard_practice_idx
    ON mv_profile_metrics (avg_score DESC NULLS LAST, profile_id)
    WHERE is_archived = FALSE AND attempt_type = 'practice';

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_profile_metrics;
