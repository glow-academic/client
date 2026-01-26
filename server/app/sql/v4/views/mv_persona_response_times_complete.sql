-- Materialized View: mv_persona_response_times
-- Pre-aggregated persona response time metrics per chat.
-- Key: (chat_id)
-- Uses idempotent drop/recreate pattern - safe to run multiple times.
--
-- IMPORTANT: This MV depends on mv_dashboard_facts.
-- mv_dashboard_facts must be created and refreshed BEFORE this one.
--
-- Key principle: Pre-aggregated for fast persona response time queries.
-- Eliminates need to UNNEST arrays at query time for leaderboard/reports.
-- ============================================================================
-- Step 1: Drop all indexes on mv_persona_response_times materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_persona_response_times'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_persona_response_times materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_persona_response_times CASCADE;

-- ============================================================================
-- Step 3: Create mv_persona_response_times Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_persona_response_times AS
WITH
-- Unnest the message_time_taken_seconds arrays from mv_dashboard_facts
unnested_times AS (
    SELECT
        f.chat_id,
        f.profile_id,
        f.simulation_id,
        f.department_id,
        f.cohort_id,
        f.attempt_type,
        f.attempt_created_at,
        UNNEST(f.message_time_taken_seconds) AS response_seconds
    FROM mv_dashboard_facts f
    WHERE f.is_archived = FALSE
      AND CARDINALITY(f.message_time_taken_seconds) > 0
)
SELECT
    -- Primary key
    chat_id,

    -- Context IDs for filtering
    profile_id,
    simulation_id,
    department_id,
    cohort_id,
    attempt_type,
    attempt_created_at,

    -- Aggregated response time metrics
    AVG(response_seconds)::numeric AS avg_response_seconds,
    MIN(response_seconds)::int AS min_response_seconds,
    MAX(response_seconds)::int AS max_response_seconds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_seconds)::numeric AS median_response_seconds,
    SUM(response_seconds)::bigint AS sum_response_seconds,
    COUNT(*)::int AS response_count

FROM unnested_times
GROUP BY
    chat_id,
    profile_id,
    simulation_id,
    department_id,
    cohort_id,
    attempt_type,
    attempt_created_at
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_persona_response_times_pk
    ON mv_persona_response_times (chat_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Context ID indexes for filtering
CREATE INDEX mv_persona_response_times_profile_id_idx
    ON mv_persona_response_times (profile_id);

CREATE INDEX mv_persona_response_times_simulation_id_idx
    ON mv_persona_response_times (simulation_id);

CREATE INDEX mv_persona_response_times_department_id_idx
    ON mv_persona_response_times (department_id)
    WHERE department_id IS NOT NULL;

CREATE INDEX mv_persona_response_times_cohort_id_idx
    ON mv_persona_response_times (cohort_id)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX mv_persona_response_times_attempt_type_idx
    ON mv_persona_response_times (attempt_type);

-- Timestamp index for date range filtering
CREATE INDEX mv_persona_response_times_attempt_created_at_idx
    ON mv_persona_response_times (attempt_created_at);

-- Response time metric indexes for sorting
CREATE INDEX mv_persona_response_times_avg_response_idx
    ON mv_persona_response_times (avg_response_seconds ASC NULLS LAST);

CREATE INDEX mv_persona_response_times_median_response_idx
    ON mv_persona_response_times (median_response_seconds ASC NULLS LAST);

-- Composite indexes for common query patterns
CREATE INDEX mv_persona_response_times_profile_sim_idx
    ON mv_persona_response_times (profile_id, simulation_id);

CREATE INDEX mv_persona_response_times_sim_profile_idx
    ON mv_persona_response_times (simulation_id, profile_id);

CREATE INDEX mv_persona_response_times_profile_avg_idx
    ON mv_persona_response_times (profile_id, avg_response_seconds ASC NULLS LAST);

CREATE INDEX mv_persona_response_times_sim_avg_idx
    ON mv_persona_response_times (simulation_id, avg_response_seconds ASC NULLS LAST);

-- Cohort-based leaderboard patterns
CREATE INDEX mv_persona_response_times_cohort_sim_avg_idx
    ON mv_persona_response_times (cohort_id, simulation_id, avg_response_seconds ASC NULLS LAST)
    WHERE cohort_id IS NOT NULL;

-- Partial indexes by attempt type
CREATE INDEX mv_persona_response_times_general_idx
    ON mv_persona_response_times (profile_id, simulation_id, avg_response_seconds ASC NULLS LAST)
    WHERE attempt_type = 'general';

CREATE INDEX mv_persona_response_times_practice_idx
    ON mv_persona_response_times (profile_id, simulation_id, avg_response_seconds ASC NULLS LAST)
    WHERE attempt_type = 'practice';

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_persona_response_times;
