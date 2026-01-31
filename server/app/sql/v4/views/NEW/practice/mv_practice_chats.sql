-- Materialized View: mv_practice_chats
-- Chat-level data for PRACTICE attempt detail endpoint.
--
-- Grain: One row per chat
-- Filter: attempt.practice = TRUE (practice only)
--
-- Purpose: Provides chat-level data with grade info and feedbacks for parallel fetching
-- Section: PRACTICE (attempt detail)
--
-- Dependencies: Only uses _entry and _connection tables
-- NOTE: Uses types.mv_feedback from mv_home_chats (must be applied first)
-- ============================================================================
-- Step 1: Drop all indexes on mv_practice_chats materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_practice_chats'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_practice_chats materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_practice_chats CASCADE;

-- ============================================================================
-- Step 3: Create mv_practice_chats Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_practice_chats AS
WITH
-- Latest grade per chat (most recent grade)
latest_grade AS (
    SELECT DISTINCT ON (g.chat_id)
        g.id AS grade_id,
        g.chat_id,
        g.score AS grade_score,
        g.passed AS grade_passed,
        g.description AS grade_description,
        g.time_taken AS grade_time_taken,
        g.total_points AS rubric_total_points,
        g.pass_points AS rubric_pass_points,
        g.created_at AS grade_created_at
    FROM simulation_grades_entry g
    WHERE g.active = TRUE
    ORDER BY g.chat_id, g.created_at DESC
),
-- Feedbacks aggregated per grade
feedbacks_agg AS (
    SELECT
        fe.grade_id,
        ARRAY_AGG(
            (fe.id, fsc.standard_id, fe.total::float, fe.feedback)::types.mv_feedback
            ORDER BY fe.created_at
        ) AS feedbacks
    FROM simulation_feedbacks_entry fe
    LEFT JOIN feedbacks_standards_connection fsc ON fsc.feedbacks_id = fe.id
    WHERE fe.active = TRUE
    GROUP BY fe.grade_id
),
-- Compute chat position and current chat status
chats_with_position AS (
    SELECT
        c.id AS chat_id,
        c.attempt_id,
        c.created_at AS chat_created_at,
        c.completed AS chat_completed,
        csc.scenarios_id AS scenario_id,
        cpc.personas_id AS persona_id,
        grc.rubrics_id AS rubric_id,
        ROW_NUMBER() OVER (PARTITION BY c.attempt_id ORDER BY c.created_at) AS chat_position
    FROM simulation_chats_entry c
    JOIN simulation_attempts_entry a ON a.id = c.attempt_id
    JOIN simulation_chats_scenarios_connection csc ON csc.chat_id = c.id
    LEFT JOIN simulation_chats_personas_connection cpc ON cpc.chat_id = c.id
    LEFT JOIN latest_grade lg ON lg.chat_id = c.id
    LEFT JOIN simulation_grades_rubrics_connection grc ON grc.grade_id = lg.grade_id
    WHERE c.active = TRUE
      AND a.active = TRUE
      AND a.practice = TRUE  -- practice only
),
-- Determine which chat is "current" (first incomplete or last if all complete)
current_chat_per_attempt AS (
    SELECT DISTINCT ON (attempt_id)
        attempt_id,
        chat_id AS current_chat_id
    FROM chats_with_position
    ORDER BY attempt_id, chat_completed ASC, chat_position DESC
)
SELECT
    -- Primary key
    cwp.chat_id,

    -- Foreign keys for parallel lookup
    cwp.attempt_id,

    -- Resource IDs (from connections for _resource joins at runtime)
    cwp.scenario_id,
    cwp.persona_id,
    cwp.rubric_id,

    -- Chat data
    cwp.chat_created_at,
    cwp.chat_completed,
    cwp.chat_position::int,
    (cwp.chat_id = cca.current_chat_id) AS is_current_chat,

    -- Grade data (from latest grade)
    lg.grade_id,
    lg.grade_score,
    lg.grade_passed,
    lg.grade_description,
    lg.grade_time_taken,
    lg.rubric_total_points,
    lg.rubric_pass_points,

    -- Feedbacks array (denormalized for grading state display)
    COALESCE(fa.feedbacks, ARRAY[]::types.mv_feedback[]) AS feedbacks

FROM chats_with_position cwp
LEFT JOIN current_chat_per_attempt cca ON cca.attempt_id = cwp.attempt_id
LEFT JOIN latest_grade lg ON lg.chat_id = cwp.chat_id
LEFT JOIN feedbacks_agg fa ON fa.grade_id = lg.grade_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_practice_chats_pk
    ON mv_practice_chats (chat_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Attempt ID for parallel lookup
CREATE INDEX mv_practice_chats_attempt_id_idx
    ON mv_practice_chats (attempt_id);

-- Scenario ID for filtering
CREATE INDEX mv_practice_chats_scenario_id_idx
    ON mv_practice_chats (scenario_id);

-- Persona ID for filtering
CREATE INDEX mv_practice_chats_persona_id_idx
    ON mv_practice_chats (persona_id)
    WHERE persona_id IS NOT NULL;

-- Grade ID for joins
CREATE INDEX mv_practice_chats_grade_id_idx
    ON mv_practice_chats (grade_id)
    WHERE grade_id IS NOT NULL;

-- Current chat partial index (for quick "current chat" lookups)
CREATE INDEX mv_practice_chats_current_chat_idx
    ON mv_practice_chats (attempt_id)
    WHERE is_current_chat = TRUE;

-- Completed status
CREATE INDEX mv_practice_chats_completed_idx
    ON mv_practice_chats (chat_completed);

-- Composite: attempt + position for ordering
CREATE INDEX mv_practice_chats_attempt_position_idx
    ON mv_practice_chats (attempt_id, chat_position);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_practice_chats;
