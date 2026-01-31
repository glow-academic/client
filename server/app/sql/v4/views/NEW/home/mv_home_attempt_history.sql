-- Materialized View: mv_home_attempt_history
-- Attempt-level aggregation for HOME section.
--
-- Grain: One row per attempt
-- Purpose: Main MV for both home overview AND home history endpoints
--          - Overview: aggregate by simulation_id with date filtering
--          - History: paginated list of attempts with date filtering
--
-- Section: HOME
-- Source: Aggregate from mv_home_chat_facts grouped by attempt_id
-- Dependencies: Only uses mv_home_chat_facts (which only uses _entry and _connection tables)
--
-- ============================================================================
-- Step 1: Drop all indexes on mv_home_attempt_history materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_home_attempt_history'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_home_attempt_history materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_home_attempt_history CASCADE;

-- ============================================================================
-- Step 3: Create mv_home_attempt_history Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_home_attempt_history AS
SELECT
    -- Keys
    attempt_id,
    profile_id,
    simulation_id,
    cohort_id,
    department_id,

    -- Timestamps
    MIN(attempt_created_at) AS attempt_created_at,

    -- Flags
    BOOL_OR(infinite_mode) AS infinite_mode,

    -- Pre-aggregated from chats
    COUNT(*)::int AS num_chats,
    COUNT(*) FILTER (WHERE completed = TRUE)::int AS num_chats_completed,
    COUNT(DISTINCT scenario_id)::int AS num_scenarios,
    COUNT(DISTINCT scenario_id) FILTER (WHERE completed = TRUE)::int AS num_scenarios_completed,
    TRUNC(AVG(grade_percent), 2) AS score_percent,
    BOOL_OR(passed) AS has_passed,
    SUM(COALESCE(time_taken, 0))::int AS total_time_seconds,

    -- Rubric points (for computing pass_pct in Python)
    -- Takes MAX since all chats in an attempt share the same rubric
    MAX(rubric_total_points)::int AS rubric_total_points,
    MAX(rubric_pass_points)::int AS rubric_pass_points,

    -- Arrays for display (IDs only - join to _resource at query time)
    ARRAY_AGG(DISTINCT scenario_id) FILTER (WHERE scenario_id IS NOT NULL) AS scenario_ids,
    ARRAY_AGG(DISTINCT persona_id) FILTER (WHERE persona_id IS NOT NULL) AS persona_ids

FROM mv_home_chat_facts
GROUP BY attempt_id, profile_id, simulation_id, cohort_id, department_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_home_attempt_history_pk
    ON mv_home_attempt_history (attempt_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary lookup: profile's attempts
CREATE INDEX mv_home_attempt_history_profile_id_idx
    ON mv_home_attempt_history (profile_id);

-- Simulation filtering
CREATE INDEX mv_home_attempt_history_simulation_id_idx
    ON mv_home_attempt_history (simulation_id);

-- Cohort filtering
CREATE INDEX mv_home_attempt_history_cohort_id_idx
    ON mv_home_attempt_history (cohort_id)
    WHERE cohort_id IS NOT NULL;

-- Department filtering
CREATE INDEX mv_home_attempt_history_department_id_idx
    ON mv_home_attempt_history (department_id)
    WHERE department_id IS NOT NULL;

-- Time-based sorting (most common for history pages)
CREATE INDEX mv_home_attempt_history_created_at_idx
    ON mv_home_attempt_history (attempt_created_at DESC);

-- Composite: profile + time for user history pagination
CREATE INDEX mv_home_attempt_history_profile_created_idx
    ON mv_home_attempt_history (profile_id, attempt_created_at DESC);

-- Composite: simulation + time for simulation history
CREATE INDEX mv_home_attempt_history_simulation_created_idx
    ON mv_home_attempt_history (simulation_id, attempt_created_at DESC);

-- Composite: cohort + time for cohort history
CREATE INDEX mv_home_attempt_history_cohort_created_idx
    ON mv_home_attempt_history (cohort_id, attempt_created_at DESC)
    WHERE cohort_id IS NOT NULL;

-- Pass status filtering
CREATE INDEX mv_home_attempt_history_has_passed_idx
    ON mv_home_attempt_history (has_passed)
    WHERE has_passed = TRUE;

-- Score-based sorting
CREATE INDEX mv_home_attempt_history_score_percent_idx
    ON mv_home_attempt_history (score_percent DESC NULLS LAST)
    WHERE score_percent IS NOT NULL;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_home_attempt_history;
