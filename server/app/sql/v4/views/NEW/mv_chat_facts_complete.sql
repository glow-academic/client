-- Materialized View: mv_chat_facts
-- Base fact table for all analytics.
--
-- Grain: One row per chat
-- Uses idempotent drop/recreate pattern - safe to run multiple times.
--
-- Key principle: MVs only go stale when new records are added.
-- Resource metadata changes (names, descriptions) are always fresh via query-time joins.
--
-- Dependencies: Only uses _entry and _connection tables (no _resource or _junction tables)
-- ============================================================================
-- Step 1: Drop all indexes on mv_chat_facts materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_chat_facts'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_chat_facts materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_chat_facts CASCADE;

-- ============================================================================
-- Step 3: Create mv_chat_facts Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_chat_facts AS
WITH
-- Message counts per chat
message_counts AS (
    SELECT
        m.chat_id,
        COUNT(*)::int AS num_messages_total,
        COUNT(*) FILTER (WHERE m.role = 'user')::int AS num_query_messages,
        COUNT(*) FILTER (WHERE m.role = 'assistant')::int AS num_response_messages
    FROM simulation_messages_entry m
    WHERE m.active = TRUE
    GROUP BY m.chat_id
),
-- Latest grade per chat (most recent grade) with rubric points
latest_grade AS (
    SELECT DISTINCT ON (g.chat_id)
        g.id AS grade_id,
        g.chat_id,
        g.score,
        g.passed,
        g.time_taken,
        g.created_at,
        g.total_points AS rubric_total_points,
        g.pass_points AS rubric_pass_points
    FROM simulation_grades_entry g
    WHERE g.active = TRUE
    ORDER BY g.chat_id, g.created_at DESC
),
-- Message time deltas for persona response time tracking
message_deltas AS (
    SELECT
        m.chat_id,
        CASE
            WHEN lag(m.role) OVER (PARTITION BY m.chat_id ORDER BY m.created_at) = 'assistant'
             AND m.role = 'user'
            THEN GREATEST(
                   EXTRACT(epoch FROM m.created_at - lag(COALESCE(m.updated_at, m.created_at))
                       OVER (PARTITION BY m.chat_id ORDER BY m.created_at))::int, 0)
            ELSE NULL
        END AS delta_seconds
    FROM simulation_messages_entry m
    WHERE m.active = TRUE
),
message_deltas_agg AS (
    SELECT
        chat_id,
        ARRAY_REMOVE(ARRAY_AGG(delta_seconds ORDER BY delta_seconds), NULL) AS message_time_taken_seconds
    FROM message_deltas
    GROUP BY chat_id
)
SELECT
    -- Entry IDs
    c.id AS chat_id,
    a.id AS attempt_id,
    lg.grade_id,

    -- Resource IDs (from connections)
    asc_conn.simulations_id AS simulation_id,
    apc.profiles_id AS profile_id,
    acc.cohorts_id AS cohort_id,
    adc.departments_id AS department_id,
    arc.roles_id AS role_id,
    csc.scenarios_id AS scenario_id,

    -- From connection tables
    cpc.personas_id AS persona_id,
    grc.rubrics_id AS rubric_id,

    -- Timestamps (from entries)
    a.created_at AS attempt_created_at,
    c.created_at AS chat_created_at,
    lg.created_at AS grade_created_at,

    -- Flags (from entries)
    CASE
        WHEN a.practice IS TRUE THEN 'practice'::text
        ELSE 'general'::text
    END AS attempt_type,
    COALESCE(a.archived, FALSE) AS is_archived,
    COALESCE(a.infinite_mode, FALSE) AS infinite_mode,
    COALESCE(c.completed, FALSE) AS completed,

    -- Grade data (from grade entry - immutable facts)
    lg.score,
    lg.passed,
    lg.time_taken,

    -- Computed grade percent
    CASE
        WHEN lg.score IS NULL OR lg.rubric_total_points IS NULL OR lg.rubric_total_points = 0 THEN NULL
        ELSE TRUNC((lg.score::numeric / lg.rubric_total_points) * 100.0, 2)
    END AS grade_percent,

    -- Rubric points
    lg.rubric_total_points,
    lg.rubric_pass_points,

    -- Message stats (pre-aggregated)
    COALESCE(mc.num_messages_total, 0) AS num_messages_total,

    -- Message time taken for persona response times
    COALESCE(mda.message_time_taken_seconds, ARRAY[]::int[]) AS message_time_taken_seconds

FROM simulation_attempts_entry a
-- Attempt connections (required)
JOIN simulation_attempts_simulations_connection asc_conn ON asc_conn.attempt_id = a.id
JOIN simulation_attempts_profiles_connection apc ON apc.attempt_id = a.id
-- Attempt connections (optional)
LEFT JOIN simulation_attempts_departments_connection adc ON adc.attempt_id = a.id
LEFT JOIN simulation_attempts_cohorts_connection acc ON acc.attempt_id = a.id
LEFT JOIN simulation_attempts_roles_connection arc ON arc.attempt_id = a.id
-- Chat entry
JOIN simulation_chats_entry c ON c.attempt_id = a.id AND c.active = TRUE
-- Chat connections (required)
JOIN simulation_chats_scenarios_connection csc ON csc.chat_id = c.id
-- Chat connections (optional - persona)
LEFT JOIN simulation_chats_personas_connection cpc ON cpc.chat_id = c.id
-- Grade (optional - latest grade per chat)
LEFT JOIN latest_grade lg ON lg.chat_id = c.id
-- Grade connections (optional - rubric)
LEFT JOIN simulation_grades_rubrics_connection grc ON grc.grade_id = lg.grade_id
-- Message counts (pre-aggregated)
LEFT JOIN message_counts mc ON mc.chat_id = c.id
-- Message time deltas for persona response times
LEFT JOIN message_deltas_agg mda ON mda.chat_id = c.id
WHERE a.active = TRUE
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_chat_facts_pk
    ON mv_chat_facts (chat_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Entry ID indexes
CREATE INDEX mv_chat_facts_attempt_id_idx
    ON mv_chat_facts (attempt_id);

CREATE INDEX mv_chat_facts_grade_id_idx
    ON mv_chat_facts (grade_id)
    WHERE grade_id IS NOT NULL;

-- Resource ID indexes for filtering
CREATE INDEX mv_chat_facts_simulation_id_idx
    ON mv_chat_facts (simulation_id);

CREATE INDEX mv_chat_facts_profile_id_idx
    ON mv_chat_facts (profile_id);

CREATE INDEX mv_chat_facts_cohort_id_idx
    ON mv_chat_facts (cohort_id)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX mv_chat_facts_department_id_idx
    ON mv_chat_facts (department_id)
    WHERE department_id IS NOT NULL;

CREATE INDEX mv_chat_facts_role_id_idx
    ON mv_chat_facts (role_id)
    WHERE role_id IS NOT NULL;

CREATE INDEX mv_chat_facts_scenario_id_idx
    ON mv_chat_facts (scenario_id);

CREATE INDEX mv_chat_facts_persona_id_idx
    ON mv_chat_facts (persona_id)
    WHERE persona_id IS NOT NULL;

CREATE INDEX mv_chat_facts_rubric_id_idx
    ON mv_chat_facts (rubric_id)
    WHERE rubric_id IS NOT NULL;

-- Timestamp indexes for date range filtering
CREATE INDEX mv_chat_facts_attempt_created_at_idx
    ON mv_chat_facts (attempt_created_at);

CREATE INDEX mv_chat_facts_chat_created_at_idx
    ON mv_chat_facts (chat_created_at);

CREATE INDEX mv_chat_facts_grade_created_at_idx
    ON mv_chat_facts (grade_created_at)
    WHERE grade_created_at IS NOT NULL;

-- Attempt type index
CREATE INDEX mv_chat_facts_attempt_type_idx
    ON mv_chat_facts (attempt_type);

-- Flag indexes
CREATE INDEX mv_chat_facts_is_archived_idx
    ON mv_chat_facts (is_archived);

CREATE INDEX mv_chat_facts_completed_idx
    ON mv_chat_facts (completed);

CREATE INDEX mv_chat_facts_passed_idx
    ON mv_chat_facts (passed)
    WHERE passed IS NOT NULL;

-- Composite indexes for common query patterns
CREATE INDEX mv_chat_facts_simulation_attempt_created_idx
    ON mv_chat_facts (simulation_id, attempt_created_at DESC);

CREATE INDEX mv_chat_facts_profile_attempt_created_idx
    ON mv_chat_facts (profile_id, attempt_created_at DESC);

CREATE INDEX mv_chat_facts_cohort_attempt_created_idx
    ON mv_chat_facts (cohort_id, attempt_created_at DESC)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX mv_chat_facts_cohort_simulation_idx
    ON mv_chat_facts (cohort_id, simulation_id)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX mv_chat_facts_profile_simulation_idx
    ON mv_chat_facts (profile_id, simulation_id);

-- Partial indexes for common filter patterns
CREATE INDEX mv_chat_facts_not_archived_idx
    ON mv_chat_facts (attempt_created_at DESC)
    WHERE is_archived = FALSE;

CREATE INDEX mv_chat_facts_general_not_archived_idx
    ON mv_chat_facts (attempt_created_at DESC)
    WHERE attempt_type = 'general' AND is_archived = FALSE;

CREATE INDEX mv_chat_facts_practice_not_archived_idx
    ON mv_chat_facts (attempt_created_at DESC)
    WHERE attempt_type = 'practice' AND is_archived = FALSE;

-- Grade percent index for score-based filtering and sorting
CREATE INDEX mv_chat_facts_grade_percent_idx
    ON mv_chat_facts (grade_percent DESC NULLS LAST)
    WHERE grade_percent IS NOT NULL;

-- Composite index for profile leaderboard queries
CREATE INDEX mv_chat_facts_profile_grade_percent_idx
    ON mv_chat_facts (profile_id, grade_percent DESC NULLS LAST)
    WHERE grade_percent IS NOT NULL;

-- Composite index for simulation + grade percent
CREATE INDEX mv_chat_facts_simulation_grade_percent_idx
    ON mv_chat_facts (simulation_id, grade_percent DESC NULLS LAST)
    WHERE grade_percent IS NOT NULL;

-- GIN index for message_time_taken_seconds array
CREATE INDEX mv_chat_facts_message_time_taken_gin
    ON mv_chat_facts USING GIN (message_time_taken_seconds);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_chat_facts;
