-- Materialized View: mv_dashboard_persona_agg
-- Pre-aggregated persona performance statistics for dashboard.
-- Groups by: (persona_id, simulation_id, agg_date, department_id, attempt_type)
-- Uses idempotent drop/recreate pattern - safe to run multiple times.
--
-- IMPORTANT: This MV depends on mv_dashboard_facts.
-- mv_dashboard_facts must be created and refreshed BEFORE this one.
--
-- Key principle: Pre-aggregated for fast persona performance queries.
-- Still requires query-time joins to resource tables for names.
-- ============================================================================
-- Step 1: Drop all indexes on mv_dashboard_persona_agg materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_dashboard_persona_agg'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_dashboard_persona_agg materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_persona_agg CASCADE;

-- ============================================================================
-- Step 3: Create mv_dashboard_persona_agg Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_dashboard_persona_agg AS
SELECT
    -- Aggregation key
    persona_id,
    simulation_id,
    (attempt_created_at AT TIME ZONE 'UTC')::date AS agg_date,
    department_id,
    attempt_type,

    -- Chat counts
    COUNT(DISTINCT chat_id)::int AS chat_count,
    COUNT(DISTINCT chat_id) FILTER (WHERE completed = TRUE)::int AS completed_count,
    COUNT(DISTINCT chat_id) FILTER (WHERE grade_id IS NOT NULL)::int AS graded_count,

    -- Score aggregates (for graded chats only)
    SUM(score) FILTER (WHERE score IS NOT NULL)::bigint AS sum_score,
    COUNT(*) FILTER (WHERE passed = TRUE)::int AS passed_count,

    -- Time aggregates
    SUM(time_taken) FILTER (WHERE time_taken IS NOT NULL)::bigint AS sum_time_taken,

    -- Message aggregates
    SUM(num_messages_total)::bigint AS sum_messages_total,
    SUM(num_response_messages)::bigint AS sum_response_messages

FROM mv_dashboard_facts
WHERE persona_id IS NOT NULL
  AND is_archived = FALSE
GROUP BY
    persona_id,
    simulation_id,
    (attempt_created_at AT TIME ZONE 'UTC')::date,
    department_id,
    attempt_type
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

-- Composite unique key for the aggregation dimensions
CREATE UNIQUE INDEX mv_dashboard_persona_agg_pk
    ON mv_dashboard_persona_agg (
        persona_id,
        simulation_id,
        agg_date,
        COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid),
        attempt_type
    );

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary dimension indexes
CREATE INDEX mv_dashboard_persona_agg_persona_id_idx
    ON mv_dashboard_persona_agg (persona_id);

CREATE INDEX mv_dashboard_persona_agg_simulation_id_idx
    ON mv_dashboard_persona_agg (simulation_id);

CREATE INDEX mv_dashboard_persona_agg_date_idx
    ON mv_dashboard_persona_agg (agg_date);

CREATE INDEX mv_dashboard_persona_agg_department_id_idx
    ON mv_dashboard_persona_agg (department_id)
    WHERE department_id IS NOT NULL;

CREATE INDEX mv_dashboard_persona_agg_attempt_type_idx
    ON mv_dashboard_persona_agg (attempt_type);

-- Composite indexes for common query patterns
CREATE INDEX mv_dashboard_persona_agg_persona_date_idx
    ON mv_dashboard_persona_agg (persona_id, agg_date DESC);

CREATE INDEX mv_dashboard_persona_agg_persona_sim_idx
    ON mv_dashboard_persona_agg (persona_id, simulation_id);

CREATE INDEX mv_dashboard_persona_agg_sim_persona_idx
    ON mv_dashboard_persona_agg (simulation_id, persona_id);

CREATE INDEX mv_dashboard_persona_agg_sim_date_idx
    ON mv_dashboard_persona_agg (simulation_id, agg_date DESC);

-- Multi-dimension composite indexes
CREATE INDEX mv_dashboard_persona_agg_persona_sim_date_idx
    ON mv_dashboard_persona_agg (persona_id, simulation_id, agg_date DESC);

CREATE INDEX mv_dashboard_persona_agg_sim_dept_date_idx
    ON mv_dashboard_persona_agg (simulation_id, department_id, agg_date DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_dashboard_persona_agg;
