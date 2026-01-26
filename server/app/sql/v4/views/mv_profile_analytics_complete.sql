-- Materialized View: mv_profile_analytics
-- Pre-aggregated profile-level metrics for leaderboard and reports.
-- Groups by: (profile_id, simulation_id, department_id, cohort_id, attempt_type)
-- Uses idempotent drop/recreate pattern - safe to run multiple times.
--
-- IMPORTANT: This MV depends on mv_dashboard_facts.
-- mv_dashboard_facts must be created and refreshed BEFORE this one.
--
-- Key principle: Pre-aggregated for fast leaderboard and reports queries.
-- Provides profile-level metrics without needing to re-aggregate on every query.
-- ============================================================================
-- Step 1: Drop all indexes on mv_profile_analytics materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_profile_analytics'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_profile_analytics materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_profile_analytics CASCADE;

-- ============================================================================
-- Step 3: Create mv_profile_analytics Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_profile_analytics AS
SELECT
    -- Aggregation key
    profile_id,
    simulation_id,
    department_id,
    cohort_id,
    attempt_type,

    -- Attempt/Chat counts
    COUNT(DISTINCT attempt_id)::int AS total_attempts,
    COUNT(DISTINCT chat_id)::int AS total_chats,
    COUNT(DISTINCT chat_id) FILTER (WHERE completed = TRUE)::int AS completed_chats,
    COUNT(DISTINCT chat_id) FILTER (WHERE grade_id IS NOT NULL)::int AS graded_chats,

    -- Score aggregates
    MAX(grade_percent) FILTER (WHERE grade_percent IS NOT NULL)::numeric AS highest_score,
    AVG(grade_percent) FILTER (WHERE grade_percent IS NOT NULL)::numeric AS avg_score,
    SUM(score) FILTER (WHERE score IS NOT NULL)::bigint AS sum_score,

    -- Perfect score count (grade_percent >= 100)
    COUNT(*) FILTER (WHERE grade_percent IS NOT NULL AND grade_percent >= 100)::int AS perfect_score_count,

    -- Pass/fail counts
    COUNT(*) FILTER (WHERE passed = TRUE)::int AS passed_count,
    COUNT(*) FILTER (WHERE passed = FALSE)::int AS failed_count,

    -- Quickest pass (minimum time_taken where passed = TRUE)
    MIN(time_taken) FILTER (WHERE passed = TRUE)::int AS quickest_pass_seconds,

    -- Time aggregates
    SUM(time_taken) FILTER (WHERE time_taken IS NOT NULL)::bigint AS sum_time_taken,
    AVG(time_taken) FILTER (WHERE time_taken IS NOT NULL)::numeric AS avg_time_taken,

    -- Message aggregates
    SUM(num_messages_total)::bigint AS sum_messages_total,
    AVG(num_messages_total)::numeric AS avg_messages_per_chat,

    -- Persona response time count (for joining with mv_persona_response_times)
    -- Count of chats that have response time data
    COUNT(*) FILTER (WHERE CARDINALITY(message_time_taken_seconds) > 0)::int AS chats_with_response_times,

    -- Date bounds
    MIN(attempt_created_at) AS first_attempt_at,
    MAX(attempt_created_at) AS last_attempt_at

FROM mv_dashboard_facts f
WHERE is_archived = FALSE
GROUP BY
    profile_id,
    simulation_id,
    department_id,
    cohort_id,
    attempt_type
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

-- Composite unique key for profile + simulation + department + cohort + attempt_type
CREATE UNIQUE INDEX mv_profile_analytics_pk
    ON mv_profile_analytics (
        profile_id,
        simulation_id,
        COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid),
        attempt_type
    );

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary dimension indexes
CREATE INDEX mv_profile_analytics_profile_id_idx
    ON mv_profile_analytics (profile_id);

CREATE INDEX mv_profile_analytics_simulation_id_idx
    ON mv_profile_analytics (simulation_id);

CREATE INDEX mv_profile_analytics_department_id_idx
    ON mv_profile_analytics (department_id)
    WHERE department_id IS NOT NULL;

CREATE INDEX mv_profile_analytics_cohort_id_idx
    ON mv_profile_analytics (cohort_id)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX mv_profile_analytics_attempt_type_idx
    ON mv_profile_analytics (attempt_type);

-- Composite indexes for common query patterns
CREATE INDEX mv_profile_analytics_profile_sim_idx
    ON mv_profile_analytics (profile_id, simulation_id);

CREATE INDEX mv_profile_analytics_sim_profile_idx
    ON mv_profile_analytics (simulation_id, profile_id);

CREATE INDEX mv_profile_analytics_cohort_sim_idx
    ON mv_profile_analytics (cohort_id, simulation_id)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX mv_profile_analytics_dept_sim_idx
    ON mv_profile_analytics (department_id, simulation_id)
    WHERE department_id IS NOT NULL;

-- Performance metric indexes for leaderboard sorting
CREATE INDEX mv_profile_analytics_highest_score_idx
    ON mv_profile_analytics (highest_score DESC NULLS LAST);

CREATE INDEX mv_profile_analytics_avg_score_idx
    ON mv_profile_analytics (avg_score DESC NULLS LAST);

CREATE INDEX mv_profile_analytics_total_attempts_idx
    ON mv_profile_analytics (total_attempts DESC);

CREATE INDEX mv_profile_analytics_passed_count_idx
    ON mv_profile_analytics (passed_count DESC);

CREATE INDEX mv_profile_analytics_perfect_score_count_idx
    ON mv_profile_analytics (perfect_score_count DESC);

CREATE INDEX mv_profile_analytics_quickest_pass_idx
    ON mv_profile_analytics (quickest_pass_seconds ASC NULLS LAST)
    WHERE quickest_pass_seconds IS NOT NULL;

-- Leaderboard pattern indexes (simulation + score ranking)
CREATE INDEX mv_profile_analytics_sim_highest_score_idx
    ON mv_profile_analytics (simulation_id, highest_score DESC NULLS LAST);

CREATE INDEX mv_profile_analytics_sim_avg_score_idx
    ON mv_profile_analytics (simulation_id, avg_score DESC NULLS LAST);

CREATE INDEX mv_profile_analytics_cohort_sim_score_idx
    ON mv_profile_analytics (cohort_id, simulation_id, highest_score DESC NULLS LAST)
    WHERE cohort_id IS NOT NULL;

-- Date indexes
CREATE INDEX mv_profile_analytics_first_attempt_at_idx
    ON mv_profile_analytics (first_attempt_at);

CREATE INDEX mv_profile_analytics_last_attempt_at_idx
    ON mv_profile_analytics (last_attempt_at);

-- Partial index for general attempts only (common filter)
CREATE INDEX mv_profile_analytics_general_idx
    ON mv_profile_analytics (profile_id, simulation_id, highest_score DESC NULLS LAST)
    WHERE attempt_type = 'general';

-- Partial index for practice attempts only
CREATE INDEX mv_profile_analytics_practice_idx
    ON mv_profile_analytics (profile_id, simulation_id, highest_score DESC NULLS LAST)
    WHERE attempt_type = 'practice';

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_profile_analytics;
