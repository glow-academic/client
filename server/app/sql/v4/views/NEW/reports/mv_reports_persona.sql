-- Materialized View: mv_reports_persona
-- Persona-level aggregation for REPORTS section - persona performance charts.
--
-- Grain: One row per (profile_id, persona_id, simulation_id)
-- Purpose: Persona performance breakdown for individual reports
--
-- This MV is INDEPENDENT - it does not depend on any other MVs.
-- Section: REPORTS
-- Source: simulation_chats_entry, simulation_grades_entry, simulation_messages_entry, connections
--
-- Filter: is_archived = FALSE
--
-- ============================================================================
-- Step 1: Drop all indexes on mv_reports_persona materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_reports_persona'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_reports_persona materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_reports_persona CASCADE;

-- ============================================================================
-- Step 3: Create mv_reports_persona Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_reports_persona AS
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
        g.score,
        g.passed,
        g.time_taken
    FROM simulation_grades_entry g
    ORDER BY g.chat_id, g.created_at DESC
),
-- Get message counts and response times per chat
chat_messages AS (
    SELECT
        m.chat_id,
        COUNT(*)::int AS message_count,
        AVG(EXTRACT(EPOCH FROM (m.created_at - LAG(m.created_at) OVER (PARTITION BY m.chat_id ORDER BY m.created_at))))::numeric AS avg_response_time_sec
    FROM simulation_messages_entry m
    GROUP BY m.chat_id
)
SELECT
    -- Keys
    ap.profile_id,
    cp.persona_id,
    asim.simulation_id,

    -- Aggregated counts
    COUNT(DISTINCT c.id)::int AS session_count,
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

    -- Message metrics
    TRUNC(AVG(cm.message_count)::numeric, 2) AS avg_messages,
    SUM(COALESCE(cm.message_count, 0))::int AS total_messages,

    -- Response time metrics
    TRUNC(AVG(cm.avg_response_time_sec)::numeric, 2) AS avg_response_time_sec

FROM simulation_chats_entry c
JOIN simulation_attempts_entry a ON a.id = c.attempt_id
JOIN attempt_simulations asim ON asim.attempt_id = a.id
JOIN attempt_profiles ap ON ap.attempt_id = a.id
JOIN chat_personas cp ON cp.chat_id = c.id
LEFT JOIN chat_grades cg ON cg.chat_id = c.id
LEFT JOIN chat_messages cm ON cm.chat_id = c.id
WHERE a.archived = FALSE
  AND cp.persona_id IS NOT NULL
GROUP BY ap.profile_id, cp.persona_id, asim.simulation_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_reports_persona_pk
    ON mv_reports_persona (
        COALESCE(profile_id, '00000000-0000-0000-0000-000000000000'::uuid),
        persona_id,
        COALESCE(simulation_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Profile filtering (primary for reports)
CREATE INDEX mv_reports_persona_profile_id_idx
    ON mv_reports_persona (profile_id)
    WHERE profile_id IS NOT NULL;

-- Persona filtering
CREATE INDEX mv_reports_persona_persona_id_idx
    ON mv_reports_persona (persona_id);

-- Simulation filtering
CREATE INDEX mv_reports_persona_simulation_id_idx
    ON mv_reports_persona (simulation_id)
    WHERE simulation_id IS NOT NULL;

-- Composite: profile + simulation for user simulation persona breakdown
CREATE INDEX mv_reports_persona_profile_sim_idx
    ON mv_reports_persona (profile_id, simulation_id)
    WHERE profile_id IS NOT NULL;

-- Score sorting
CREATE INDEX mv_reports_persona_avg_score_idx
    ON mv_reports_persona (avg_score DESC);

-- Pass rate sorting
CREATE INDEX mv_reports_persona_pass_rate_idx
    ON mv_reports_persona (pass_rate DESC);

-- Session count sorting
CREATE INDEX mv_reports_persona_session_count_idx
    ON mv_reports_persona (session_count DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_reports_persona;
