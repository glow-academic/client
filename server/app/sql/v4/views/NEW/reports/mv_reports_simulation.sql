-- Materialized View: mv_reports_simulation
-- Simulation/Scenario-level aggregation for REPORTS section - simulation performance charts.
--
-- Grain: One row per (profile_id, simulation_id, scenario_id)
-- Purpose: Simulation and scenario performance breakdown for individual reports
--
-- This MV is INDEPENDENT - it does not depend on any other MVs.
-- Section: REPORTS
-- Source: simulation_chats_entry, simulation_grades_entry, connections
--
-- Filter: is_archived = FALSE
--
-- ============================================================================
-- Step 1: Drop all indexes on mv_reports_simulation materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_reports_simulation'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_reports_simulation materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_reports_simulation CASCADE;

-- ============================================================================
-- Step 3: Create mv_reports_simulation Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_reports_simulation AS
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
-- Get chat to scenario mapping
chat_scenarios AS (
    SELECT
        scs.chat_id,
        ssj.scenario_id
    FROM simulation_chats_scenarios_connection scs
    JOIN scenario_scenarios_junction ssj ON ssj.scenarios_id = scs.scenarios_id
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
)
SELECT
    -- Keys
    ap.profile_id,
    asim.simulation_id,
    cs.scenario_id,

    -- Aggregated counts
    COUNT(DISTINCT a.id)::int AS attempt_count,
    COUNT(DISTINCT c.id)::int AS chat_count,
    COUNT(DISTINCT c.id) FILTER (WHERE c.completed = true)::int AS completed_count,
    COUNT(DISTINCT c.id) FILTER (WHERE cg.passed = true)::int AS passed_count,

    -- Score metrics
    TRUNC(AVG(cg.score)::numeric, 2) AS avg_score,
    MAX(cg.score)::int AS max_score,
    MIN(cg.score) FILTER (WHERE cg.score IS NOT NULL)::int AS min_score,

    -- Pass rate
    CASE
        WHEN COUNT(DISTINCT c.id) > 0 THEN
            TRUNC((COUNT(DISTINCT c.id) FILTER (WHERE cg.passed = true)::numeric / COUNT(DISTINCT c.id)) * 100, 2)
        ELSE 0
    END AS pass_rate,

    -- Time metrics
    SUM(COALESCE(cg.time_taken, 0))::int AS total_time_seconds,
    TRUNC(AVG(cg.time_taken)::numeric, 2) AS avg_time_seconds

FROM simulation_chats_entry c
JOIN simulation_attempts_entry a ON a.id = c.attempt_id
JOIN attempt_simulations asim ON asim.attempt_id = a.id
JOIN attempt_profiles ap ON ap.attempt_id = a.id
LEFT JOIN chat_scenarios cs ON cs.chat_id = c.id
LEFT JOIN chat_grades cg ON cg.chat_id = c.id
WHERE a.archived = FALSE
GROUP BY ap.profile_id, asim.simulation_id, cs.scenario_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_reports_simulation_pk
    ON mv_reports_simulation (
        COALESCE(profile_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(simulation_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(scenario_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Profile filtering (primary for reports)
CREATE INDEX mv_reports_simulation_profile_id_idx
    ON mv_reports_simulation (profile_id)
    WHERE profile_id IS NOT NULL;

-- Simulation filtering
CREATE INDEX mv_reports_simulation_simulation_id_idx
    ON mv_reports_simulation (simulation_id)
    WHERE simulation_id IS NOT NULL;

-- Scenario filtering
CREATE INDEX mv_reports_simulation_scenario_id_idx
    ON mv_reports_simulation (scenario_id)
    WHERE scenario_id IS NOT NULL;

-- Composite: profile + simulation for user simulation breakdown
CREATE INDEX mv_reports_simulation_profile_sim_idx
    ON mv_reports_simulation (profile_id, simulation_id)
    WHERE profile_id IS NOT NULL;

-- Composite: simulation + scenario for scenario breakdown
CREATE INDEX mv_reports_simulation_sim_scenario_idx
    ON mv_reports_simulation (simulation_id, scenario_id)
    WHERE simulation_id IS NOT NULL;

-- Score sorting
CREATE INDEX mv_reports_simulation_avg_score_idx
    ON mv_reports_simulation (avg_score DESC);

-- Pass rate sorting
CREATE INDEX mv_reports_simulation_pass_rate_idx
    ON mv_reports_simulation (pass_rate DESC);

-- Attempt count sorting
CREATE INDEX mv_reports_simulation_attempt_count_idx
    ON mv_reports_simulation (attempt_count DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_reports_simulation;
