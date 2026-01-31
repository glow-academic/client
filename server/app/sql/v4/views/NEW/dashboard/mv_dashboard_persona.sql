-- Materialized View: mv_dashboard_persona
-- Persona performance aggregation for DASHBOARD section.
--
-- Grain: One row per (persona_id, simulation_id, cohort_id)
-- Purpose: Persona performance charts
--
-- Section: DASHBOARD
-- Source: Aggregate from mv_dashboard_chat_facts WHERE persona_id IS NOT NULL
--
-- ============================================================================
-- Step 1: Drop all indexes on mv_dashboard_persona materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_dashboard_persona'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_dashboard_persona materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_persona CASCADE;

-- ============================================================================
-- Step 3: Create mv_dashboard_persona Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_dashboard_persona AS
SELECT
    -- Keys
    persona_id,
    simulation_id,
    cohort_id,

    -- Aggregated metrics
    COUNT(*)::int AS session_count,
    TRUNC(AVG(grade_percent), 2) AS avg_score,
    TRUNC(
        (COUNT(*) FILTER (WHERE passed = TRUE)::numeric / NULLIF(COUNT(*), 0)) * 100.0,
        2
    ) AS pass_rate,
    TRUNC(AVG(num_messages_total), 2) AS avg_messages,
    -- Average response time from message_time_taken_seconds array
    TRUNC(
        AVG(
            CASE
                WHEN CARDINALITY(message_time_taken_seconds) > 0
                THEN (SELECT AVG(t)::numeric FROM UNNEST(message_time_taken_seconds) AS t)
                ELSE NULL
            END
        ),
        2
    ) AS avg_response_time_sec

FROM mv_dashboard_chat_facts
WHERE persona_id IS NOT NULL
  AND is_archived = FALSE  -- Exclude archived
GROUP BY persona_id, simulation_id, cohort_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_dashboard_persona_pk
    ON mv_dashboard_persona (
        persona_id,
        simulation_id,
        COALESCE(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary lookup: persona
CREATE INDEX mv_dashboard_persona_persona_id_idx
    ON mv_dashboard_persona (persona_id);

-- Simulation filtering
CREATE INDEX mv_dashboard_persona_simulation_id_idx
    ON mv_dashboard_persona (simulation_id);

-- Cohort filtering
CREATE INDEX mv_dashboard_persona_cohort_id_idx
    ON mv_dashboard_persona (cohort_id)
    WHERE cohort_id IS NOT NULL;

-- Composite: simulation + persona for simulation-scoped queries
CREATE INDEX mv_dashboard_persona_simulation_persona_idx
    ON mv_dashboard_persona (simulation_id, persona_id);

-- Composite: cohort + simulation for admin queries
CREATE INDEX mv_dashboard_persona_cohort_simulation_idx
    ON mv_dashboard_persona (cohort_id, simulation_id)
    WHERE cohort_id IS NOT NULL;

-- Score-based sorting
CREATE INDEX mv_dashboard_persona_avg_score_idx
    ON mv_dashboard_persona (avg_score DESC NULLS LAST)
    WHERE avg_score IS NOT NULL;

-- Pass rate sorting
CREATE INDEX mv_dashboard_persona_pass_rate_idx
    ON mv_dashboard_persona (pass_rate DESC NULLS LAST)
    WHERE pass_rate IS NOT NULL;

-- Session count sorting
CREATE INDEX mv_dashboard_persona_session_count_idx
    ON mv_dashboard_persona (session_count DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_dashboard_persona;
