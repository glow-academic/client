-- Materialized View: mv_general_analytics
-- Pre-computes joins between general entry tables and connection tables, outputting resource IDs only.
-- Query endpoints join to resource tables for current names/values.
-- Uses idempotent drop/recreate pattern - safe to run multiple times.
--
-- Key principle: MVs only go stale when new records are added.
-- Resource metadata changes (names, descriptions) are always fresh via query-time joins.
-- ============================================================================
-- Step 1: Drop all indexes on mv_general_analytics materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_general_analytics'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_general_analytics materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_general_analytics CASCADE;

-- ============================================================================
-- Step 3: Create mv_general_analytics Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_general_analytics AS
WITH
-- Message counts per chat
message_counts AS (
    SELECT
        m.chat_id,
        COUNT(*)::int AS num_messages_total,
        COUNT(*) FILTER (WHERE m.role = 'user')::int AS num_query_messages,
        COUNT(*) FILTER (WHERE m.role = 'assistant')::int AS num_response_messages
    FROM general_messages_entry m
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
        -- Rubric points denormalized directly on grade
        g.total_points AS rubric_total_points,
        g.pass_points AS rubric_pass_points
    FROM general_grades_entry g
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
    FROM general_messages_entry m
    WHERE m.active = TRUE
),
message_deltas_agg AS (
    SELECT
        chat_id,
        ARRAY_REMOVE(ARRAY_AGG(delta_seconds ORDER BY delta_seconds), NULL) AS message_time_taken_seconds
    FROM message_deltas
    GROUP BY chat_id
),
-- Parameter field IDs aggregated per chat
chat_parameter_fields AS (
    SELECT
        cpf.chat_id,
        ARRAY_AGG(cpf.parameter_fields_id ORDER BY cpf.created_at) AS parameter_field_ids
    FROM general_chats_parameter_fields_connection cpf
    GROUP BY cpf.chat_id
)
SELECT
    -- Entry IDs
    a.id AS attempt_id,
    c.id AS chat_id,
    lg.grade_id,

    -- Resource IDs (from connections)
    asc_conn.simulations_id AS simulation_id,
    apc.profiles_id AS profile_id,
    adc.departments_id AS department_id,
    acc.cohorts_id AS cohort_id,
    arc.roles_id AS role_id,
    csc.scenarios_id AS scenario_id,
    cpc.personas_id AS persona_id,
    grc.rubrics_id AS rubric_id,

    -- Parameter field IDs array
    COALESCE(cpf.parameter_field_ids, ARRAY[]::uuid[]) AS parameter_field_ids,

    -- Timestamps (from entries)
    a.created_at AS attempt_created_at,
    c.created_at AS chat_created_at,
    lg.created_at AS grade_created_at,

    -- Flags (from entries)
    COALESCE(a.archived, FALSE) AS is_archived,
    COALESCE(a.infinite_mode, FALSE) AS infinite_mode,
    COALESCE(c.completed, FALSE) AS completed,

    -- Grade data (from grade entry - immutable facts)
    lg.score,
    lg.passed,
    lg.time_taken,

    -- Rubric points (for grade_percent calculation)
    lg.rubric_total_points,
    lg.rubric_pass_points,
    -- Computed grade percent
    CASE
        WHEN lg.score IS NULL OR lg.rubric_total_points IS NULL OR lg.rubric_total_points = 0 THEN NULL
        ELSE TRUNC((lg.score::numeric / lg.rubric_total_points) * 100.0, 2)
    END AS grade_percent,

    -- Message stats (pre-aggregated)
    COALESCE(mc.num_messages_total, 0) AS num_messages_total,
    COALESCE(mc.num_query_messages, 0) AS num_query_messages,
    COALESCE(mc.num_response_messages, 0) AS num_response_messages,

    -- Message time taken for persona response times
    COALESCE(mda.message_time_taken_seconds, ARRAY[]::int[]) AS message_time_taken_seconds

FROM general_attempts_entry a
-- Attempt connections (required)
JOIN general_attempts_simulations_connection asc_conn ON asc_conn.attempt_id = a.id
JOIN general_attempts_profiles_connection apc ON apc.attempt_id = a.id
-- Attempt connections (optional)
LEFT JOIN general_attempts_departments_connection adc ON adc.attempt_id = a.id
LEFT JOIN general_attempts_cohorts_connection acc ON acc.attempt_id = a.id
LEFT JOIN general_attempts_roles_connection arc ON arc.attempt_id = a.id
-- Chat entry
JOIN general_chats_entry c ON c.attempt_id = a.id AND c.active = TRUE
-- Chat connections (required)
JOIN general_chats_scenarios_connection csc ON csc.chat_id = c.id
-- Chat connections (optional)
LEFT JOIN general_chats_personas_connection cpc ON cpc.chat_id = c.id
LEFT JOIN chat_parameter_fields cpf ON cpf.chat_id = c.id
-- Grade (optional - latest grade per chat)
LEFT JOIN latest_grade lg ON lg.chat_id = c.id
-- Grade connections (optional)
LEFT JOIN general_grades_rubrics_connection grc ON grc.grade_id = lg.grade_id
-- Message time deltas for persona response times
LEFT JOIN message_deltas_agg mda ON mda.chat_id = c.id
WHERE a.active = TRUE
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_general_analytics_pk
    ON mv_general_analytics (chat_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary key alternatives for different access patterns
CREATE INDEX mv_general_analytics_attempt_id_idx
    ON mv_general_analytics (attempt_id);

CREATE INDEX mv_general_analytics_grade_id_idx
    ON mv_general_analytics (grade_id)
    WHERE grade_id IS NOT NULL;

-- Resource ID indexes for filtering
CREATE INDEX mv_general_analytics_simulation_id_idx
    ON mv_general_analytics (simulation_id);

CREATE INDEX mv_general_analytics_profile_id_idx
    ON mv_general_analytics (profile_id);

CREATE INDEX mv_general_analytics_department_id_idx
    ON mv_general_analytics (department_id)
    WHERE department_id IS NOT NULL;

CREATE INDEX mv_general_analytics_cohort_id_idx
    ON mv_general_analytics (cohort_id)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX mv_general_analytics_role_id_idx
    ON mv_general_analytics (role_id)
    WHERE role_id IS NOT NULL;

CREATE INDEX mv_general_analytics_scenario_id_idx
    ON mv_general_analytics (scenario_id);

CREATE INDEX mv_general_analytics_persona_id_idx
    ON mv_general_analytics (persona_id)
    WHERE persona_id IS NOT NULL;

CREATE INDEX mv_general_analytics_rubric_id_idx
    ON mv_general_analytics (rubric_id)
    WHERE rubric_id IS NOT NULL;

-- Timestamp indexes for date range filtering
CREATE INDEX mv_general_analytics_attempt_created_at_idx
    ON mv_general_analytics (attempt_created_at);

CREATE INDEX mv_general_analytics_chat_created_at_idx
    ON mv_general_analytics (chat_created_at);

CREATE INDEX mv_general_analytics_grade_created_at_idx
    ON mv_general_analytics (grade_created_at)
    WHERE grade_created_at IS NOT NULL;

-- Flag indexes
CREATE INDEX mv_general_analytics_is_archived_idx
    ON mv_general_analytics (is_archived);

CREATE INDEX mv_general_analytics_completed_idx
    ON mv_general_analytics (completed);

CREATE INDEX mv_general_analytics_passed_idx
    ON mv_general_analytics (passed)
    WHERE passed IS NOT NULL;

-- GIN index for parameter_field_ids array filtering
CREATE INDEX mv_general_analytics_parameter_field_ids_gin
    ON mv_general_analytics USING GIN (parameter_field_ids);

-- Composite indexes for common query patterns
CREATE INDEX mv_general_analytics_simulation_attempt_created_idx
    ON mv_general_analytics (simulation_id, attempt_created_at DESC);

CREATE INDEX mv_general_analytics_profile_attempt_created_idx
    ON mv_general_analytics (profile_id, attempt_created_at DESC);

CREATE INDEX mv_general_analytics_cohort_attempt_created_idx
    ON mv_general_analytics (cohort_id, attempt_created_at DESC)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX mv_general_analytics_department_attempt_created_idx
    ON mv_general_analytics (department_id, attempt_created_at DESC)
    WHERE department_id IS NOT NULL;

-- Partial index for non-archived records (common filter)
CREATE INDEX mv_general_analytics_not_archived_idx
    ON mv_general_analytics (attempt_created_at DESC)
    WHERE is_archived = FALSE;

-- Grade percent index for score-based filtering and sorting
CREATE INDEX mv_general_analytics_grade_percent_idx
    ON mv_general_analytics (grade_percent DESC NULLS LAST)
    WHERE grade_percent IS NOT NULL;

-- Rubric points indexes
CREATE INDEX mv_general_analytics_rubric_total_points_idx
    ON mv_general_analytics (rubric_total_points)
    WHERE rubric_total_points IS NOT NULL;

-- GIN index for message_time_taken_seconds array
CREATE INDEX mv_general_analytics_message_time_taken_gin
    ON mv_general_analytics USING GIN (message_time_taken_seconds);

-- Composite index for profile leaderboard queries
CREATE INDEX mv_general_analytics_profile_grade_percent_idx
    ON mv_general_analytics (profile_id, grade_percent DESC NULLS LAST)
    WHERE grade_percent IS NOT NULL;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_general_analytics;
