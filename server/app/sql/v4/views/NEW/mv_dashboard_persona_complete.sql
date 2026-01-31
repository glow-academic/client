-- Materialized View: mv_dashboard_persona
-- Pre-aggregates persona performance metrics for Dashboard.
--
-- Grain: One row per (persona_id, simulation_id, cohort_id)
-- Purpose: Dashboard persona performance chart
--
-- Source: Aggregates from mv_chat_facts grouped by persona + simulation + cohort
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
          AND tablename = 'mv_dashboard_persona'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop materialized view if exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_persona CASCADE;

-- ============================================================================
-- Step 3: Create Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_dashboard_persona AS
SELECT
    -- Keys
    persona_id,
    simulation_id,
    cohort_id,

    -- Aggregated metrics
    COUNT(*)::int AS session_count,
    ROUND(AVG(grade_percent), 2) AS avg_score,
    ROUND(AVG(num_messages_total), 2) AS avg_messages,
    -- Average persona response time (avg of array median per chat)
    ROUND(AVG(
        CASE
            WHEN ARRAY_LENGTH(message_time_taken_seconds, 1) > 0
            THEN (
                SELECT AVG(v)::numeric
                FROM unnest(message_time_taken_seconds) AS v
            )
            ELSE NULL
        END
    ), 2) AS avg_response_time_sec

FROM mv_chat_facts
WHERE attempt_type = 'general'
  AND is_archived = FALSE
  AND persona_id IS NOT NULL
GROUP BY persona_id, simulation_id, cohort_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_dashboard_persona_pk
    ON mv_dashboard_persona (persona_id, simulation_id, COALESCE(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary access pattern: persona lookup
CREATE INDEX mv_dashboard_persona_persona_id_idx
    ON mv_dashboard_persona (persona_id);

-- Simulation filter
CREATE INDEX mv_dashboard_persona_simulation_id_idx
    ON mv_dashboard_persona (simulation_id);

-- Cohort filter
CREATE INDEX mv_dashboard_persona_cohort_id_idx
    ON mv_dashboard_persona (cohort_id)
    WHERE cohort_id IS NOT NULL;

-- Composite for dashboard queries
CREATE INDEX mv_dashboard_persona_cohort_simulation_idx
    ON mv_dashboard_persona (cohort_id, simulation_id)
    WHERE cohort_id IS NOT NULL;

-- Score ranking
CREATE INDEX mv_dashboard_persona_avg_score_idx
    ON mv_dashboard_persona (avg_score DESC NULLS LAST);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_dashboard_persona;
