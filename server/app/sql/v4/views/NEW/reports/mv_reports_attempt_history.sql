-- Materialized View: mv_reports_attempt_history
-- Attempt-level aggregation for REPORTS section - history page.
--
-- Grain: One row per attempt_id
-- Purpose: Fast paginated list of attempts for individual reports
--
-- This MV is INDEPENDENT - it does not depend on any other MVs.
-- Section: REPORTS
-- Source: simulation_attempts_entry, simulation_chats_entry, simulation_grades_entry, connections
--
-- Filter: is_archived = FALSE (reports show non-archived data)
--
-- ============================================================================
-- Step 1: Drop all indexes on mv_reports_attempt_history materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_reports_attempt_history'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_reports_attempt_history materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_reports_attempt_history CASCADE;

-- ============================================================================
-- Step 3: Create mv_reports_attempt_history Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_reports_attempt_history AS
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
-- Get attempt to cohort mapping
attempt_cohorts AS (
    SELECT
        sac.attempt_id,
        ARRAY_AGG(DISTINCT ccj.cohort_id) FILTER (WHERE ccj.cohort_id IS NOT NULL) AS cohort_ids
    FROM simulation_attempts_cohorts_connection sac
    JOIN cohort_cohorts_junction ccj ON ccj.cohorts_id = sac.cohorts_id
    GROUP BY sac.attempt_id
),
-- Get attempt to department mapping
attempt_departments AS (
    SELECT
        sad.attempt_id,
        ARRAY_AGG(DISTINCT ddj.department_id) FILTER (WHERE ddj.department_id IS NOT NULL) AS department_ids
    FROM simulation_attempts_departments_connection sad
    JOIN department_departments_junction ddj ON ddj.departments_id = sad.departments_id
    GROUP BY sad.attempt_id
),
-- Get chat to scenario mapping
chat_scenarios AS (
    SELECT
        scs.chat_id,
        ssj.scenario_id
    FROM simulation_chats_scenarios_connection scs
    JOIN scenario_scenarios_junction ssj ON ssj.scenarios_id = scs.scenarios_id
),
-- Get chat to persona mapping
chat_personas AS (
    SELECT
        scp.chat_id,
        ppj.persona_id
    FROM simulation_chats_personas_connection scp
    JOIN persona_personas_junction ppj ON ppj.personas_id = scp.personas_id
),
-- Get latest grade per chat
chat_grades AS (
    SELECT DISTINCT ON (g.chat_id)
        g.chat_id,
        g.id AS grade_id,
        g.score,
        g.passed,
        g.time_taken,
        g.created_at AS grade_created_at
    FROM simulation_grades_entry g
    ORDER BY g.chat_id, g.created_at DESC
),
-- Get rubric info per grade
grade_rubrics AS (
    SELECT
        sgr.grade_id,
        rrj.rubric_id
    FROM simulation_grades_rubrics_connection sgr
    JOIN rubric_rubrics_junction rrj ON rrj.rubrics_id = sgr.rubrics_id
),
-- Aggregate chat-level data per attempt
attempt_chat_rollup AS (
    SELECT
        c.attempt_id,
        COUNT(*)::int AS num_chats,
        COUNT(*) FILTER (WHERE c.completed = true)::int AS num_chats_completed,
        COUNT(DISTINCT cs.scenario_id)::int AS num_scenarios,
        COUNT(DISTINCT cs.scenario_id) FILTER (WHERE c.completed = true)::int AS num_scenarios_completed,
        ARRAY_AGG(DISTINCT cs.scenario_id) FILTER (WHERE cs.scenario_id IS NOT NULL) AS scenario_ids,
        ARRAY_AGG(DISTINCT cp.persona_id) FILTER (WHERE cp.persona_id IS NOT NULL) AS persona_ids,
        SUM(COALESCE(cg.time_taken, 0))::int AS total_time_seconds,
        AVG(CASE
            WHEN cg.score IS NOT NULL THEN cg.score::numeric
            ELSE NULL
        END) AS avg_score,
        BOOL_OR(COALESCE(cg.passed, false)) AS has_passed
    FROM simulation_chats_entry c
    LEFT JOIN chat_scenarios cs ON cs.chat_id = c.id
    LEFT JOIN chat_personas cp ON cp.chat_id = c.id
    LEFT JOIN chat_grades cg ON cg.chat_id = c.id
    GROUP BY c.attempt_id
)
SELECT
    -- Primary key
    a.id AS attempt_id,

    -- Context IDs
    ap.profile_id,
    asim.simulation_id,
    COALESCE(ac.cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
    COALESCE(ad.department_ids, ARRAY[]::uuid[]) AS department_ids,

    -- Timestamps
    a.created_at AS attempt_created_at,

    -- Attempt flags
    CASE
        WHEN EXISTS (
            SELECT 1 FROM simulation_attempts_flags_junction saf
            JOIN attempt_flags_resource afr ON afr.id = saf.attempt_flag_id
            JOIN flags_resource f ON f.id = afr.flag_id
            WHERE saf.attempt_id = a.id AND f.name = 'practice' AND saf.value = true
        ) THEN 'practice'
        ELSE 'general'
    END AS attempt_type,
    COALESCE(a.infinite_mode, false) AS infinite_mode,
    COALESCE(a.archived, false) AS is_archived,

    -- Pre-aggregated from chats
    COALESCE(acr.num_chats, 0) AS num_chats,
    COALESCE(acr.num_chats_completed, 0) AS num_chats_completed,
    COALESCE(acr.num_scenarios, 0) AS num_scenarios,
    COALESCE(acr.num_scenarios_completed, 0) AS num_scenarios_completed,
    COALESCE(acr.scenario_ids, ARRAY[]::uuid[]) AS scenario_ids,
    COALESCE(acr.persona_ids, ARRAY[]::uuid[]) AS persona_ids,
    COALESCE(acr.total_time_seconds, 0) AS total_time_seconds,
    TRUNC(COALESCE(acr.avg_score, 0)::numeric, 2) AS avg_score,
    COALESCE(acr.has_passed, false) AS has_passed

FROM simulation_attempts_entry a
LEFT JOIN attempt_simulations asim ON asim.attempt_id = a.id
LEFT JOIN attempt_profiles ap ON ap.attempt_id = a.id
LEFT JOIN attempt_cohorts ac ON ac.attempt_id = a.id
LEFT JOIN attempt_departments ad ON ad.attempt_id = a.id
LEFT JOIN attempt_chat_rollup acr ON acr.attempt_id = a.id
WHERE a.archived = FALSE
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_reports_attempt_history_pk
    ON mv_reports_attempt_history (attempt_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Profile filtering (primary for reports)
CREATE INDEX mv_reports_attempt_history_profile_id_idx
    ON mv_reports_attempt_history (profile_id)
    WHERE profile_id IS NOT NULL;

-- Simulation filtering
CREATE INDEX mv_reports_attempt_history_simulation_id_idx
    ON mv_reports_attempt_history (simulation_id)
    WHERE simulation_id IS NOT NULL;

-- Attempt type filtering
CREATE INDEX mv_reports_attempt_history_attempt_type_idx
    ON mv_reports_attempt_history (attempt_type);

-- Timestamp sorting
CREATE INDEX mv_reports_attempt_history_created_at_idx
    ON mv_reports_attempt_history (attempt_created_at DESC);

-- Composite: profile + created for user history
CREATE INDEX mv_reports_attempt_history_profile_created_idx
    ON mv_reports_attempt_history (profile_id, attempt_created_at DESC)
    WHERE profile_id IS NOT NULL;

-- Composite: profile + simulation for user simulation history
CREATE INDEX mv_reports_attempt_history_profile_sim_idx
    ON mv_reports_attempt_history (profile_id, simulation_id)
    WHERE profile_id IS NOT NULL;

-- Score sorting
CREATE INDEX mv_reports_attempt_history_avg_score_idx
    ON mv_reports_attempt_history (avg_score DESC);

-- Passed filtering
CREATE INDEX mv_reports_attempt_history_passed_idx
    ON mv_reports_attempt_history (has_passed)
    WHERE has_passed = true;

-- GIN indexes for array filtering
CREATE INDEX mv_reports_attempt_history_cohort_ids_gin
    ON mv_reports_attempt_history USING GIN (cohort_ids);

CREATE INDEX mv_reports_attempt_history_department_ids_gin
    ON mv_reports_attempt_history USING GIN (department_ids);

CREATE INDEX mv_reports_attempt_history_scenario_ids_gin
    ON mv_reports_attempt_history USING GIN (scenario_ids);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_reports_attempt_history;
