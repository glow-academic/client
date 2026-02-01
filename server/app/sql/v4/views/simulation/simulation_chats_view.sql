-- Materialized View: mv_simulation_chats
-- Chat-level data for simulation attempt detail views.
--
-- Grain: One row per chat
-- Filter: archived = FALSE only (practice is a column, not a filter)
--
-- Purpose: Provides chat-level data with grade info and feedbacks for parallel fetching
-- Section: SIMULATION (unified view - both home and practice)
--
-- Dependencies: Only uses _entry and _connection tables
-- ============================================================================
-- Step 0: Drop and recreate composite types
-- ============================================================================

-- Create feedback type if it doesn't exist
DO $$
BEGIN
    CREATE TYPE types.mv_feedback AS (
        id uuid,
        standard_id uuid,
        total float,
        feedback text
    );
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- Create response type for raw quiz responses (no response_id - not a resource)
DO $$
BEGIN
    CREATE TYPE types.mv_response AS (
        question_id uuid,
        option_id uuid,
        completed boolean,
        created_at timestamptz
    );
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- ============================================================================
-- Step 1: Drop all indexes on mv_simulation_chats materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_simulation_chats'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_simulation_chats materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_simulation_chats CASCADE;

-- ============================================================================
-- Step 3: Create mv_simulation_chats Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_simulation_chats AS
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
        grc.rubrics_id AS rubric_id,
        COALESCE(a.practice, FALSE) AS practice,
        -- Chat-level flags (directly on simulation_chats_entry)
        c.copy_paste_allowed,
        c.text_enabled,
        c.audio_enabled,
        c.hints_enabled,
        c.show_images,
        c.show_objectives,
        c.show_problem_statement,
        ROW_NUMBER() OVER (PARTITION BY c.attempt_id ORDER BY c.created_at) AS chat_position
    FROM simulation_chats_entry c
    JOIN simulation_attempts_entry a ON a.id = c.attempt_id
    JOIN simulation_chats_scenarios_connection csc ON csc.chat_id = c.id
    LEFT JOIN latest_grade lg ON lg.chat_id = c.id
    LEFT JOIN simulation_grades_rubrics_connection grc ON grc.grade_id = lg.grade_id
    WHERE c.active = TRUE
      AND a.active = TRUE
      AND COALESCE(a.archived, FALSE) = FALSE
),
-- Determine which chat is "current" (first incomplete or last if all complete)
current_chat_per_attempt AS (
    SELECT DISTINCT ON (attempt_id)
        attempt_id,
        chat_id AS current_chat_id
    FROM chats_with_position
    ORDER BY attempt_id, chat_completed ASC, chat_position DESC
),
-- Aggregate persona IDs per chat (plural array)
personas_agg AS (
    SELECT
        chp.chat_id,
        ARRAY_AGG(chp.personas_id ORDER BY chp.created_at)
            FILTER (WHERE chp.personas_id IS NOT NULL) AS persona_ids
    FROM simulation_chats_personas_connection chp
    WHERE chp.active = TRUE
    GROUP BY chp.chat_id
),
-- Get problem statement ID per chat (singular - first active)
problem_statements_agg AS (
    SELECT DISTINCT ON (chps.chat_id)
        chps.chat_id,
        chps.problem_statements_id AS problem_statement_id
    FROM simulation_chats_problem_statements_connection chps
    WHERE chps.active = TRUE
    ORDER BY chps.chat_id, chps.created_at
),
-- Aggregate objective IDs per chat
objectives_agg AS (
    SELECT
        cho.chat_id,
        ARRAY_AGG(cho.objectives_id ORDER BY cho.created_at)
            FILTER (WHERE cho.objectives_id IS NOT NULL) AS objective_ids
    FROM simulation_chats_objectives_connection cho
    WHERE cho.active = TRUE
    GROUP BY cho.chat_id
),
-- Aggregate question IDs per chat
questions_agg AS (
    SELECT
        chq.chat_id,
        ARRAY_AGG(chq.questions_id ORDER BY chq.created_at)
            FILTER (WHERE chq.questions_id IS NOT NULL) AS question_ids
    FROM simulation_chats_questions_connection chq
    WHERE chq.active = TRUE
    GROUP BY chq.chat_id
),
-- Aggregate option IDs per chat
options_agg AS (
    SELECT
        cho.chat_id,
        ARRAY_AGG(cho.options_id ORDER BY cho.created_at)
            FILTER (WHERE cho.options_id IS NOT NULL) AS option_ids
    FROM simulation_chats_options_connection cho
    WHERE cho.active = TRUE
    GROUP BY cho.chat_id
),
-- Aggregate template IDs per chat
templates_agg AS (
    SELECT
        cht.chat_id,
        ARRAY_AGG(cht.templates_id ORDER BY cht.created_at)
            FILTER (WHERE cht.templates_id IS NOT NULL) AS template_ids
    FROM simulation_chats_templates_connection cht
    WHERE cht.active = TRUE
    GROUP BY cht.chat_id
),
-- Aggregate responses per chat (composite type with question and option - no response_id)
responses_agg AS (
    SELECT
        r.chat_id,
        ARRAY_AGG(
            (
                rqc.question_id,
                roc.option_id,
                r.completed,
                r.created_at
            )::types.mv_response
            ORDER BY r.created_at
        ) FILTER (WHERE r.id IS NOT NULL) AS responses
    FROM responses_entry r
    LEFT JOIN responses_questions_connection rqc ON rqc.responses_id = r.id AND rqc.active = TRUE
    LEFT JOIN responses_options_connection roc ON roc.responses_id = r.id AND roc.active = TRUE
    WHERE r.active = TRUE
    GROUP BY r.chat_id
),
-- Aggregate image IDs per chat (simple UUID array)
images_agg AS (
    SELECT
        chi.chat_id,
        ARRAY_AGG(chi.images_id ORDER BY chi.created_at)
            FILTER (WHERE chi.images_id IS NOT NULL) AS image_ids
    FROM simulation_chats_images_connection chi
    WHERE chi.active = TRUE
    GROUP BY chi.chat_id
),
-- Aggregate video IDs per chat (simple UUID array)
videos_agg AS (
    SELECT
        chv.chat_id,
        ARRAY_AGG(chv.videos_id ORDER BY chv.created_at)
            FILTER (WHERE chv.videos_id IS NOT NULL) AS video_ids
    FROM simulation_chats_videos_connection chv
    WHERE chv.active = TRUE
    GROUP BY chv.chat_id
),
-- Aggregate document IDs per chat (simple UUID array)
documents_agg AS (
    SELECT
        chd.chat_id,
        ARRAY_AGG(chd.documents_id ORDER BY chd.created_at)
            FILTER (WHERE chd.documents_id IS NOT NULL) AS document_ids
    FROM simulation_chats_documents_connection chd
    WHERE chd.active = TRUE
    GROUP BY chd.chat_id
),
-- Aggregate standard_group IDs per chat (from connection table)
standard_groups_agg AS (
    SELECT
        scsg.chat_id,
        ARRAY_AGG(scsg.standard_groups_id ORDER BY scsg.created_at)
            FILTER (WHERE scsg.standard_groups_id IS NOT NULL) AS standard_group_ids
    FROM simulation_chats_standard_groups_connection scsg
    WHERE scsg.active = TRUE
    GROUP BY scsg.chat_id
),
-- Aggregate standard IDs per chat (from connection table)
standards_agg AS (
    SELECT
        scs.chat_id,
        ARRAY_AGG(scs.standards_id ORDER BY scs.created_at)
            FILTER (WHERE scs.standards_id IS NOT NULL) AS standard_ids
    FROM simulation_chats_standards_connection scs
    WHERE scs.active = TRUE
    GROUP BY scs.chat_id
)
SELECT
    -- Primary key
    cwp.chat_id,

    -- Foreign keys for parallel lookup
    cwp.attempt_id,

    -- Resource IDs (from connections for _resource joins at runtime)
    cwp.scenario_id,
    cwp.rubric_id,

    -- Practice flag (exposed as column for filtering)
    cwp.practice,

    -- Chat-level flags (directly from simulation_chats_entry)
    cwp.copy_paste_allowed,
    cwp.text_enabled,
    cwp.audio_enabled,
    cwp.hints_enabled,
    cwp.show_images,
    cwp.show_objectives,
    cwp.show_problem_statement,

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
    COALESCE(fa.feedbacks, ARRAY[]::types.mv_feedback[]) AS feedbacks,

    -- Resource IDs - Normal/General View
    psa.problem_statement_id,
    COALESCE(pa.persona_ids, ARRAY[]::uuid[]) AS persona_ids,
    COALESCE(oa.objective_ids, ARRAY[]::uuid[]) AS objective_ids,

    -- Resource IDs - Video/Quiz View
    COALESCE(qa.question_ids, ARRAY[]::uuid[]) AS question_ids,
    COALESCE(opta.option_ids, ARRAY[]::uuid[]) AS option_ids,
    COALESCE(ra.responses, ARRAY[]::types.mv_response[]) AS responses,

    -- Resource IDs - Both Views
    COALESCE(ta.template_ids, ARRAY[]::uuid[]) AS template_ids,
    COALESCE(ia.image_ids, ARRAY[]::uuid[]) AS image_ids,
    COALESCE(va.video_ids, ARRAY[]::uuid[]) AS video_ids,
    COALESCE(da.document_ids, ARRAY[]::uuid[]) AS document_ids,

    -- Rubric/Grade resource IDs (from connection tables)
    COALESCE(sga.standard_group_ids, ARRAY[]::uuid[]) AS standard_group_ids,
    COALESCE(sa.standard_ids, ARRAY[]::uuid[]) AS standard_ids

FROM chats_with_position cwp
LEFT JOIN current_chat_per_attempt cca ON cca.attempt_id = cwp.attempt_id
LEFT JOIN latest_grade lg ON lg.chat_id = cwp.chat_id
LEFT JOIN feedbacks_agg fa ON fa.grade_id = lg.grade_id
LEFT JOIN personas_agg pa ON pa.chat_id = cwp.chat_id
LEFT JOIN problem_statements_agg psa ON psa.chat_id = cwp.chat_id
LEFT JOIN objectives_agg oa ON oa.chat_id = cwp.chat_id
LEFT JOIN questions_agg qa ON qa.chat_id = cwp.chat_id
LEFT JOIN options_agg opta ON opta.chat_id = cwp.chat_id
LEFT JOIN templates_agg ta ON ta.chat_id = cwp.chat_id
LEFT JOIN responses_agg ra ON ra.chat_id = cwp.chat_id
LEFT JOIN images_agg ia ON ia.chat_id = cwp.chat_id
LEFT JOIN videos_agg va ON va.chat_id = cwp.chat_id
LEFT JOIN documents_agg da ON da.chat_id = cwp.chat_id
LEFT JOIN standard_groups_agg sga ON sga.chat_id = cwp.chat_id
LEFT JOIN standards_agg sa ON sa.chat_id = cwp.chat_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_simulation_chats_pk
    ON mv_simulation_chats (chat_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Practice flag for filtering home vs practice
CREATE INDEX mv_simulation_chats_practice_idx
    ON mv_simulation_chats (practice);

-- Attempt ID for parallel lookup
CREATE INDEX mv_simulation_chats_attempt_id_idx
    ON mv_simulation_chats (attempt_id);

-- Scenario ID for filtering
CREATE INDEX mv_simulation_chats_scenario_id_idx
    ON mv_simulation_chats (scenario_id);

-- Grade ID for joins
CREATE INDEX mv_simulation_chats_grade_id_idx
    ON mv_simulation_chats (grade_id)
    WHERE grade_id IS NOT NULL;

-- Current chat partial index (for quick "current chat" lookups)
CREATE INDEX mv_simulation_chats_current_chat_idx
    ON mv_simulation_chats (attempt_id)
    WHERE is_current_chat = TRUE;

-- Completed status
CREATE INDEX mv_simulation_chats_completed_idx
    ON mv_simulation_chats (chat_completed);

-- Composite: attempt + position for ordering
CREATE INDEX mv_simulation_chats_attempt_position_idx
    ON mv_simulation_chats (attempt_id, chat_position);

-- Composite: practice + attempt (common filter pattern)
CREATE INDEX mv_simulation_chats_practice_attempt_idx
    ON mv_simulation_chats (practice, attempt_id);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_simulation_chats;
