-- Materialized View: mv_benchmark_analytics
-- Pre-computes joins between benchmark entry tables and connection tables, outputting resource IDs only.
-- Query endpoints join to resource tables for current names/values.
-- Uses idempotent drop/recreate pattern - safe to run multiple times.
--
-- Key principle: MVs only go stale when new records are added.
-- Resource metadata changes (names, descriptions) are always fresh via query-time joins.
--
-- Note: Benchmark attempts are for eval/benchmark runs:
--   - Has eval_id instead of simulation_id
--   - Has run_id and group_id from chat connections
--   - NO scenario_id, persona_id, cohort_id, or parameter_field_ids
-- ============================================================================
-- Step 1: Drop all indexes on mv_benchmark_analytics materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_benchmark_analytics'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_benchmark_analytics materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_benchmark_analytics CASCADE;

-- ============================================================================
-- Step 3: Create mv_benchmark_analytics Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_benchmark_analytics AS
WITH
-- Message counts per chat
message_counts AS (
    SELECT
        m.chat_id,
        COUNT(*)::int AS num_messages_total,
        COUNT(*) FILTER (WHERE m.role = 'user')::int AS num_query_messages,
        COUNT(*) FILTER (WHERE m.role = 'assistant')::int AS num_response_messages
    FROM benchmark_messages_entry m
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
    FROM benchmark_grades_entry g
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
    FROM benchmark_messages_entry m
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
    a.id AS attempt_id,
    c.id AS chat_id,
    lg.grade_id,

    -- Resource IDs (from connections) - benchmark-specific
    aec.evals_id AS eval_id,
    apc.profiles_id AS profile_id,
    adc.departments_id AS department_id,
    arc.roles_id AS role_id,
    -- Chat connections for benchmark (run_id and group_id)
    crc.runs_id AS run_id,
    cgc.groups_id AS group_id,
    grc.rubrics_id AS rubric_id,

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

FROM benchmark_attempts_entry a
-- Attempt connections (required for benchmark: evals)
JOIN benchmark_attempts_evals_connection aec ON aec.attempt_id = a.id
-- Attempt connections (optional)
LEFT JOIN benchmark_attempts_profiles_connection apc ON apc.attempt_id = a.id
LEFT JOIN benchmark_attempts_departments_connection adc ON adc.attempt_id = a.id
LEFT JOIN benchmark_attempts_roles_connection arc ON arc.attempt_id = a.id
-- Chat entry
JOIN benchmark_chats_entry c ON c.attempt_id = a.id AND c.active = TRUE
-- Chat connections (optional - benchmark chats link to runs/groups)
LEFT JOIN benchmark_chats_runs_connection crc ON crc.chat_id = c.id
LEFT JOIN benchmark_chats_groups_connection cgc ON cgc.chat_id = c.id
-- Grade (optional - latest grade per chat)
LEFT JOIN latest_grade lg ON lg.chat_id = c.id
-- Grade connections (optional)
LEFT JOIN benchmark_grades_rubrics_connection grc ON grc.grade_id = lg.grade_id
-- Message counts (pre-aggregated)
LEFT JOIN message_counts mc ON mc.chat_id = c.id
-- Message time deltas for persona response times
LEFT JOIN message_deltas_agg mda ON mda.chat_id = c.id
WHERE a.active = TRUE
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_benchmark_analytics_pk
    ON mv_benchmark_analytics (chat_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary key alternatives for different access patterns
CREATE INDEX mv_benchmark_analytics_attempt_id_idx
    ON mv_benchmark_analytics (attempt_id);

CREATE INDEX mv_benchmark_analytics_grade_id_idx
    ON mv_benchmark_analytics (grade_id)
    WHERE grade_id IS NOT NULL;

-- Resource ID indexes for filtering (benchmark-specific)
CREATE INDEX mv_benchmark_analytics_eval_id_idx
    ON mv_benchmark_analytics (eval_id);

CREATE INDEX mv_benchmark_analytics_profile_id_idx
    ON mv_benchmark_analytics (profile_id)
    WHERE profile_id IS NOT NULL;

CREATE INDEX mv_benchmark_analytics_department_id_idx
    ON mv_benchmark_analytics (department_id)
    WHERE department_id IS NOT NULL;

CREATE INDEX mv_benchmark_analytics_role_id_idx
    ON mv_benchmark_analytics (role_id)
    WHERE role_id IS NOT NULL;

CREATE INDEX mv_benchmark_analytics_run_id_idx
    ON mv_benchmark_analytics (run_id)
    WHERE run_id IS NOT NULL;

CREATE INDEX mv_benchmark_analytics_group_id_idx
    ON mv_benchmark_analytics (group_id)
    WHERE group_id IS NOT NULL;

CREATE INDEX mv_benchmark_analytics_rubric_id_idx
    ON mv_benchmark_analytics (rubric_id)
    WHERE rubric_id IS NOT NULL;

-- Timestamp indexes for date range filtering
CREATE INDEX mv_benchmark_analytics_attempt_created_at_idx
    ON mv_benchmark_analytics (attempt_created_at);

CREATE INDEX mv_benchmark_analytics_chat_created_at_idx
    ON mv_benchmark_analytics (chat_created_at);

CREATE INDEX mv_benchmark_analytics_grade_created_at_idx
    ON mv_benchmark_analytics (grade_created_at)
    WHERE grade_created_at IS NOT NULL;

-- Flag indexes
CREATE INDEX mv_benchmark_analytics_is_archived_idx
    ON mv_benchmark_analytics (is_archived);

CREATE INDEX mv_benchmark_analytics_completed_idx
    ON mv_benchmark_analytics (completed);

CREATE INDEX mv_benchmark_analytics_passed_idx
    ON mv_benchmark_analytics (passed)
    WHERE passed IS NOT NULL;

-- Composite indexes for common query patterns
CREATE INDEX mv_benchmark_analytics_eval_attempt_created_idx
    ON mv_benchmark_analytics (eval_id, attempt_created_at DESC);

CREATE INDEX mv_benchmark_analytics_profile_attempt_created_idx
    ON mv_benchmark_analytics (profile_id, attempt_created_at DESC)
    WHERE profile_id IS NOT NULL;

CREATE INDEX mv_benchmark_analytics_department_attempt_created_idx
    ON mv_benchmark_analytics (department_id, attempt_created_at DESC)
    WHERE department_id IS NOT NULL;

-- Partial index for non-archived records (common filter)
CREATE INDEX mv_benchmark_analytics_not_archived_idx
    ON mv_benchmark_analytics (attempt_created_at DESC)
    WHERE is_archived = FALSE;

-- Grade percent index for score-based filtering and sorting
CREATE INDEX mv_benchmark_analytics_grade_percent_idx
    ON mv_benchmark_analytics (grade_percent DESC NULLS LAST)
    WHERE grade_percent IS NOT NULL;

-- Rubric points indexes
CREATE INDEX mv_benchmark_analytics_rubric_total_points_idx
    ON mv_benchmark_analytics (rubric_total_points)
    WHERE rubric_total_points IS NOT NULL;

-- GIN index for message_time_taken_seconds array
CREATE INDEX mv_benchmark_analytics_message_time_taken_gin
    ON mv_benchmark_analytics USING GIN (message_time_taken_seconds);

-- Composite index for eval leaderboard queries
CREATE INDEX mv_benchmark_analytics_eval_grade_percent_idx
    ON mv_benchmark_analytics (eval_id, grade_percent DESC NULLS LAST)
    WHERE grade_percent IS NOT NULL;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_benchmark_analytics;
