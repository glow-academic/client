-- Materialized View: mv_reports_daily
-- Daily aggregation for REPORTS section - time series charts.
--
-- Grain: One row per (date, profile_id, simulation_id, attempt_type)
-- Purpose: Daily trend charts for individual reports
--
-- This MV is INDEPENDENT - it does not depend on any other MVs.
-- Section: REPORTS
-- Source: simulation_attempts_entry, simulation_chats_entry, simulation_grades_entry, connections
--
-- Filter: is_archived = FALSE
--
-- ============================================================================
-- Step 1: Drop all indexes on mv_reports_daily materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_reports_daily'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_reports_daily materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_reports_daily CASCADE;

-- ============================================================================
-- Step 3: Create mv_reports_daily Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_reports_daily AS
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
-- Determine attempt_type
attempt_types AS (
    SELECT
        a.id AS attempt_id,
        CASE
            WHEN EXISTS (
                SELECT 1 FROM simulation_attempts_flags_junction saf
                JOIN attempt_flags_resource afr ON afr.id = saf.attempt_flag_id
                JOIN flags_resource f ON f.id = afr.flag_id
                WHERE saf.attempt_id = a.id AND f.name = 'practice' AND saf.value = true
            ) THEN 'practice'
            ELSE 'general'
        END AS attempt_type
    FROM simulation_attempts_entry a
    WHERE a.archived = FALSE
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
),
-- Get message counts per chat
chat_messages AS (
    SELECT
        m.chat_id,
        COUNT(*)::int AS message_count
    FROM simulation_messages_entry m
    GROUP BY m.chat_id
),
-- Build chat-level facts
chat_facts AS (
    SELECT
        c.attempt_id,
        c.id AS chat_id,
        c.completed,
        cs.scenario_id,
        cg.score,
        cg.passed,
        cg.time_taken,
        COALESCE(cm.message_count, 0) AS message_count
    FROM simulation_chats_entry c
    JOIN simulation_attempts_entry a ON a.id = c.attempt_id
    LEFT JOIN chat_scenarios cs ON cs.chat_id = c.id
    LEFT JOIN chat_grades cg ON cg.chat_id = c.id
    LEFT JOIN chat_messages cm ON cm.chat_id = c.id
    WHERE a.archived = FALSE
)
SELECT
    -- Keys
    (a.created_at::date) AS date_key,
    ap.profile_id,
    asim.simulation_id,
    at.attempt_type,

    -- Aggregated counts
    COUNT(DISTINCT a.id)::int AS attempt_count,
    COUNT(DISTINCT cf.chat_id)::int AS chat_count,
    COUNT(DISTINCT cf.chat_id) FILTER (WHERE cf.completed = true)::int AS completed_count,
    COUNT(DISTINCT cf.chat_id) FILTER (WHERE cf.passed = true)::int AS passed_count,
    COUNT(DISTINCT cf.scenario_id)::int AS unique_scenarios,

    -- Score metrics
    TRUNC(AVG(cf.score)::numeric, 2) AS avg_score,
    MAX(cf.score)::int AS max_score,
    MIN(cf.score) FILTER (WHERE cf.score IS NOT NULL)::int AS min_score,

    -- Time metrics
    SUM(COALESCE(cf.time_taken, 0))::int AS total_time_seconds,
    TRUNC(AVG(cf.time_taken)::numeric, 2) AS avg_time_seconds,

    -- Message metrics
    SUM(cf.message_count)::int AS total_messages,
    TRUNC(AVG(cf.message_count)::numeric, 2) AS avg_messages

FROM simulation_attempts_entry a
JOIN attempt_simulations asim ON asim.attempt_id = a.id
JOIN attempt_profiles ap ON ap.attempt_id = a.id
JOIN attempt_types at ON at.attempt_id = a.id
LEFT JOIN chat_facts cf ON cf.attempt_id = a.id
WHERE a.archived = FALSE
GROUP BY (a.created_at::date), ap.profile_id, asim.simulation_id, at.attempt_type
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_reports_daily_pk
    ON mv_reports_daily (
        date_key,
        COALESCE(profile_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(simulation_id, '00000000-0000-0000-0000-000000000000'::uuid),
        attempt_type
    );

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Date range queries
CREATE INDEX mv_reports_daily_date_key_idx
    ON mv_reports_daily (date_key);

CREATE INDEX mv_reports_daily_date_key_desc_idx
    ON mv_reports_daily (date_key DESC);

-- Profile filtering (primary for reports)
CREATE INDEX mv_reports_daily_profile_id_idx
    ON mv_reports_daily (profile_id)
    WHERE profile_id IS NOT NULL;

-- Simulation filtering
CREATE INDEX mv_reports_daily_simulation_id_idx
    ON mv_reports_daily (simulation_id)
    WHERE simulation_id IS NOT NULL;

-- Attempt type filtering
CREATE INDEX mv_reports_daily_attempt_type_idx
    ON mv_reports_daily (attempt_type);

-- Composite: profile + date for user time series
CREATE INDEX mv_reports_daily_profile_date_idx
    ON mv_reports_daily (profile_id, date_key DESC)
    WHERE profile_id IS NOT NULL;

-- Composite: profile + simulation + date
CREATE INDEX mv_reports_daily_profile_sim_date_idx
    ON mv_reports_daily (profile_id, simulation_id, date_key DESC)
    WHERE profile_id IS NOT NULL;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_reports_daily;
