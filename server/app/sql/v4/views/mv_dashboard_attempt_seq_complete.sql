-- Materialized View: mv_dashboard_attempt_seq
-- Pre-computes attempt sequences per profile+simulation for tracking:
-- - First attempt vs retakes
-- - Attempt progression over time
-- - Learning curve analysis
-- Uses idempotent drop/recreate pattern - safe to run multiple times.
--
-- IMPORTANT: This MV depends on mv_dashboard_facts.
-- mv_dashboard_facts must be created and refreshed BEFORE this one.
--
-- Key principle: Pre-computed attempt numbers and sequence stats.
-- ============================================================================
-- Step 1: Drop all indexes on mv_dashboard_attempt_seq materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_dashboard_attempt_seq'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_dashboard_attempt_seq materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_attempt_seq CASCADE;

-- ============================================================================
-- Step 3: Create mv_dashboard_attempt_seq Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_dashboard_attempt_seq AS
WITH
-- Get attempt-level aggregates from dashboard facts
attempt_stats AS (
    SELECT
        attempt_id,
        profile_id,
        simulation_id,
        department_id,
        cohort_id,
        attempt_type,
        MIN(attempt_created_at) AS attempt_created_at,
        MIN(chat_created_at) AS first_chat_at,
        COUNT(DISTINCT scenario_id)::int AS completed_scenarios,
        COUNT(DISTINCT chat_id)::int AS total_chats,
        AVG(score) FILTER (WHERE score IS NOT NULL)::numeric AS avg_score,
        BOOL_OR(passed) AS passed
    FROM mv_dashboard_facts
    WHERE is_archived = FALSE
    GROUP BY
        attempt_id, profile_id, simulation_id, department_id, cohort_id, attempt_type
),
-- Number attempts per profile+simulation
numbered_attempts AS (
    SELECT
        attempt_id,
        profile_id,
        simulation_id,
        department_id,
        cohort_id,
        attempt_type,
        attempt_created_at,
        first_chat_at,
        completed_scenarios,
        total_chats,
        avg_score,
        passed,
        ROW_NUMBER() OVER (
            PARTITION BY profile_id, simulation_id
            ORDER BY attempt_created_at ASC
        )::int AS attempt_number
    FROM attempt_stats
)
SELECT
    -- Primary key
    attempt_id,

    -- Dimension IDs
    profile_id,
    simulation_id,
    department_id,
    cohort_id,
    attempt_type,

    -- Sequence info
    attempt_number,
    (attempt_number = 1) AS is_first_attempt,

    -- Timestamps
    attempt_created_at,
    first_chat_at,

    -- Attempt stats
    completed_scenarios,
    total_chats,
    ROUND(avg_score, 2) AS avg_score,
    passed

FROM numbered_attempts
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_dashboard_attempt_seq_pk
    ON mv_dashboard_attempt_seq (attempt_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Dimension ID indexes for filtering
CREATE INDEX mv_dashboard_attempt_seq_profile_id_idx
    ON mv_dashboard_attempt_seq (profile_id);

CREATE INDEX mv_dashboard_attempt_seq_simulation_id_idx
    ON mv_dashboard_attempt_seq (simulation_id);

CREATE INDEX mv_dashboard_attempt_seq_department_id_idx
    ON mv_dashboard_attempt_seq (department_id)
    WHERE department_id IS NOT NULL;

CREATE INDEX mv_dashboard_attempt_seq_cohort_id_idx
    ON mv_dashboard_attempt_seq (cohort_id)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX mv_dashboard_attempt_seq_attempt_type_idx
    ON mv_dashboard_attempt_seq (attempt_type);

-- Sequence indexes
CREATE INDEX mv_dashboard_attempt_seq_attempt_number_idx
    ON mv_dashboard_attempt_seq (attempt_number);

CREATE INDEX mv_dashboard_attempt_seq_is_first_attempt_idx
    ON mv_dashboard_attempt_seq (is_first_attempt)
    WHERE is_first_attempt = TRUE;

-- Timestamp indexes
CREATE INDEX mv_dashboard_attempt_seq_attempt_created_at_idx
    ON mv_dashboard_attempt_seq (attempt_created_at);

CREATE INDEX mv_dashboard_attempt_seq_first_chat_at_idx
    ON mv_dashboard_attempt_seq (first_chat_at);

-- Passed index
CREATE INDEX mv_dashboard_attempt_seq_passed_idx
    ON mv_dashboard_attempt_seq (passed)
    WHERE passed = TRUE;

-- Composite indexes for common query patterns
CREATE INDEX mv_dashboard_attempt_seq_profile_sim_idx
    ON mv_dashboard_attempt_seq (profile_id, simulation_id);

CREATE INDEX mv_dashboard_attempt_seq_profile_sim_num_idx
    ON mv_dashboard_attempt_seq (profile_id, simulation_id, attempt_number);

CREATE INDEX mv_dashboard_attempt_seq_sim_first_idx
    ON mv_dashboard_attempt_seq (simulation_id, is_first_attempt)
    WHERE is_first_attempt = TRUE;

CREATE INDEX mv_dashboard_attempt_seq_cohort_sim_idx
    ON mv_dashboard_attempt_seq (cohort_id, simulation_id)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX mv_dashboard_attempt_seq_dept_sim_idx
    ON mv_dashboard_attempt_seq (department_id, simulation_id)
    WHERE department_id IS NOT NULL;

CREATE INDEX mv_dashboard_attempt_seq_sim_date_idx
    ON mv_dashboard_attempt_seq (simulation_id, attempt_created_at DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_dashboard_attempt_seq;
