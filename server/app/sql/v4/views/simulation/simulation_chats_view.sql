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
-- Step 0: Drop and recreate composite types for feedbacks
-- ============================================================================

-- Drop existing type if it exists (use CASCADE to handle dependencies)
DO $$
BEGIN
    -- Only drop if we're recreating the MV (types are shared with home views)
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mv_feedback' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')) THEN
        NULL;  -- Type doesn't exist, will be created below
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Create feedback type if it doesn't exist (shared with mv_home_chats)
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

-- Create image_ref type (image_id + upload_id)
DO $$
BEGIN
    CREATE TYPE types.mv_image_ref AS (
        image_id uuid,
        upload_id uuid
    );
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- Create video_ref type (video_id + upload_id)
DO $$
BEGIN
    CREATE TYPE types.mv_video_ref AS (
        video_id uuid,
        upload_id uuid
    );
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- Create document_ref type (document_id + upload_id)
DO $$
BEGIN
    CREATE TYPE types.mv_document_ref AS (
        document_id uuid,
        upload_id uuid
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
        cpc.personas_id AS persona_id,
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
    LEFT JOIN simulation_chats_personas_connection cpc ON cpc.chat_id = c.id
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
-- Aggregate images per chat (image_id + upload_id as uploads_resource.id)
-- Path: simulation_chats_images_connection → images_uploads_connection → uploads_uploads_connection
images_agg AS (
    SELECT
        chi.chat_id,
        ARRAY_AGG(
            (chi.images_id, uuc.uploads_id)::types.mv_image_ref
            ORDER BY chi.created_at
        ) FILTER (WHERE chi.images_id IS NOT NULL) AS images
    FROM simulation_chats_images_connection chi
    LEFT JOIN images_uploads_connection iuc ON iuc.images_id = chi.images_id AND iuc.active = TRUE
    LEFT JOIN uploads_uploads_connection uuc ON uuc.upload_id = iuc.upload_id AND uuc.active = TRUE
    WHERE chi.active = TRUE
    GROUP BY chi.chat_id
),
-- Aggregate videos per chat (video_id + upload_id as uploads_resource.id)
-- Path: simulation_chats_videos_connection → videos_uploads_connection → uploads_uploads_connection
videos_agg AS (
    SELECT
        chv.chat_id,
        ARRAY_AGG(
            (chv.videos_id, uuc.uploads_id)::types.mv_video_ref
            ORDER BY chv.created_at
        ) FILTER (WHERE chv.videos_id IS NOT NULL) AS videos
    FROM simulation_chats_videos_connection chv
    LEFT JOIN videos_uploads_connection vuc ON vuc.videos_id = chv.videos_id AND vuc.active = TRUE
    LEFT JOIN uploads_uploads_connection uuc ON uuc.upload_id = vuc.upload_id AND uuc.active = TRUE
    WHERE chv.active = TRUE
    GROUP BY chv.chat_id
),
-- Aggregate documents per chat (document_id + upload_id as uploads_resource.id)
-- Path: simulation_chats_documents_connection → documents_uploads_connection → uploads_uploads_connection
documents_agg AS (
    SELECT
        chd.chat_id,
        ARRAY_AGG(
            (chd.documents_id, uuc.uploads_id)::types.mv_document_ref
            ORDER BY chd.created_at
        ) FILTER (WHERE chd.documents_id IS NOT NULL) AS documents
    FROM simulation_chats_documents_connection chd
    LEFT JOIN documents_uploads_connection duc ON duc.documents_id = chd.documents_id AND duc.active = TRUE
    LEFT JOIN uploads_uploads_connection uuc ON uuc.upload_id = duc.upload_id AND uuc.active = TRUE
    WHERE chd.active = TRUE
    GROUP BY chd.chat_id
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

    -- Asset references (resource_id + upload_id from _connection tables)
    COALESCE(ia.images, ARRAY[]::types.mv_image_ref[]) AS images,
    COALESCE(va.videos, ARRAY[]::types.mv_video_ref[]) AS videos,
    COALESCE(da.documents, ARRAY[]::types.mv_document_ref[]) AS documents

FROM chats_with_position cwp
LEFT JOIN current_chat_per_attempt cca ON cca.attempt_id = cwp.attempt_id
LEFT JOIN latest_grade lg ON lg.chat_id = cwp.chat_id
LEFT JOIN feedbacks_agg fa ON fa.grade_id = lg.grade_id
LEFT JOIN images_agg ia ON ia.chat_id = cwp.chat_id
LEFT JOIN videos_agg va ON va.chat_id = cwp.chat_id
LEFT JOIN documents_agg da ON da.chat_id = cwp.chat_id
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

-- Persona ID for filtering
CREATE INDEX mv_simulation_chats_persona_id_idx
    ON mv_simulation_chats (persona_id)
    WHERE persona_id IS NOT NULL;

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
