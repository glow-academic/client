-- Materialized View: mv_practice_attempt_chats
-- Attempt complete view for PRACTICE section - chat detail for single attempt.
--
-- Grain: One row per chat (for single attempt detail view)
-- Purpose: When viewing a completed practice attempt, show all chats
--
-- Section: PRACTICE
-- Source: Same as mv_practice_chat_facts (identical structure for single-attempt queries)
--
-- Note: This MV is identical to mv_practice_chat_facts. The primary key on chat_id
-- and index on attempt_id enables efficient single-attempt lookups.
-- Could be consolidated with mv_practice_chat_facts if duplication is undesirable.
--
-- ============================================================================
-- Step 1: Drop all indexes on mv_practice_attempt_chats materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_practice_attempt_chats'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_practice_attempt_chats materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_practice_attempt_chats CASCADE;

-- ============================================================================
-- Step 3: Create mv_practice_attempt_chats Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_practice_attempt_chats AS
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

    -- Flags (attempt_type filtered out - always 'practice')
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
  AND a.practice = TRUE  -- practice only
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_practice_attempt_chats_pk
    ON mv_practice_attempt_chats (chat_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary lookup: attempt's chats (CRITICAL for attempt detail page)
CREATE INDEX mv_practice_attempt_chats_attempt_id_idx
    ON mv_practice_attempt_chats (attempt_id);

-- Profile filtering
CREATE INDEX mv_practice_attempt_chats_profile_id_idx
    ON mv_practice_attempt_chats (profile_id);

-- Simulation filtering
CREATE INDEX mv_practice_attempt_chats_simulation_id_idx
    ON mv_practice_attempt_chats (simulation_id);

-- Scenario filtering
CREATE INDEX mv_practice_attempt_chats_scenario_id_idx
    ON mv_practice_attempt_chats (scenario_id);

-- Persona filtering
CREATE INDEX mv_practice_attempt_chats_persona_id_idx
    ON mv_practice_attempt_chats (persona_id)
    WHERE persona_id IS NOT NULL;

-- Time-based sorting
CREATE INDEX mv_practice_attempt_chats_chat_created_at_idx
    ON mv_practice_attempt_chats (chat_created_at);

-- Composite: attempt + chat time for ordered chat list
CREATE INDEX mv_practice_attempt_chats_attempt_chat_created_idx
    ON mv_practice_attempt_chats (attempt_id, chat_created_at);

-- Archive status
CREATE INDEX mv_practice_attempt_chats_is_archived_idx
    ON mv_practice_attempt_chats (is_archived);

-- Completion status
CREATE INDEX mv_practice_attempt_chats_completed_idx
    ON mv_practice_attempt_chats (completed);

-- Pass status
CREATE INDEX mv_practice_attempt_chats_passed_idx
    ON mv_practice_attempt_chats (passed)
    WHERE passed IS NOT NULL;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_practice_attempt_chats;
