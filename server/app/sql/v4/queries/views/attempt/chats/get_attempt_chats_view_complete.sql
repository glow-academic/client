-- ============================================================================
-- Query: get_attempt_chats_view
-- Purpose: Fetch chat-level data from mv_attempt_chats with resource JOINs
-- Section: VIEWS/ATTEMPT/CHATS
-- ============================================================================

-- ============================================================================
-- Step 1: Drop existing function
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_attempt_chats_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_attempt_chats_view_v4(%s)', r.sig);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop existing composite types
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_attempt_chats_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

-- Grade composite type (no grade_id - not a resource)
CREATE TYPE types.q_get_attempt_chats_view_v4_grade AS (
    score float,
    passed boolean,
    time_taken int,
    total_points int,
    pass_points int
);

-- Main chat item type (IDs from MV - metadata fetched separately via internal handlers)
CREATE TYPE types.q_get_attempt_chats_view_v4_item AS (
    -- Primary key
    chat_id uuid,

    -- Foreign keys
    attempt_id uuid,

    -- Config chain entry point
    group_id uuid,

    -- Resource IDs (singular - metadata fetched via internal handlers)
    scenario_id uuid,
    rubric_id uuid,
    problem_statement_id uuid,

    -- Chat-level flags (directly from MV)
    copy_paste_allowed boolean,
    text_enabled boolean,
    audio_enabled boolean,
    hints_enabled boolean,
    show_images boolean,
    show_objectives boolean,
    show_problem_statement boolean,

    -- Time limit (denormalized, 0 = no limit)
    time_limit_seconds int,
    -- Negative time flag (allows timer to go negative)
    negative boolean,

    -- Chat metadata (top-level, position/is_current derived in service layer)
    created_at timestamptz,
    completed boolean,

    -- Grade (composite type - no id, no rubric points)
    grade types.q_get_attempt_chats_view_v4_grade,

    -- Resource IDs - Normal/General View (plural arrays)
    persona_ids uuid[],
    objective_ids uuid[],

    -- Resource IDs - Video/Quiz View (plural arrays)
    question_ids uuid[],
    option_ids uuid[],

    -- Resource IDs - Both Views (plural arrays)
    image_ids uuid[],
    video_ids uuid[],
    document_ids uuid[],

    -- Rubric/Grade resource IDs
    standard_group_ids uuid[],
    standard_ids uuid[]
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_attempt_chats_view_v4(
    attempt_ids_filter uuid[]
)
RETURNS TABLE (
    items types.q_get_attempt_chats_view_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
    WITH
    -- Fetch from MV by attempt IDs
    mv_data AS (
        SELECT mv.*
        FROM mv_attempt_chats mv
        WHERE mv.attempt_id = ANY(attempt_ids_filter)
    ),
    -- Pass through from mv_data - no resource JOINs needed
    with_resources AS (
        SELECT
            mv.chat_id,
            mv.attempt_id,
            mv.group_id,
            mv.scenario_id,
            mv.rubric_id,
            mv.problem_statement_id,
            -- Chat-level flags (directly from MV)
            mv.copy_paste_allowed,
            mv.text_enabled,
            mv.audio_enabled,
            mv.hints_enabled,
            mv.show_images,
            mv.show_objectives,
            mv.show_problem_statement,
            -- Time limit (denormalized)
            mv.time_limit_seconds,
            -- Negative time flag (allows timer to go negative)
            mv.negative,
            -- Chat metadata (top-level, position/is_current derived in service layer)
            mv.chat_created_at AS created_at,
            mv.chat_completed AS completed,
            -- Grade (composite type)
            (mv.grade_score, mv.grade_passed, mv.grade_time_taken, mv.grade_total_points, mv.grade_pass_points)::types.q_get_attempt_chats_view_v4_grade AS grade,
            -- Resource IDs - Normal/General View
            mv.persona_ids,
            mv.objective_ids,
            -- Resource IDs - Video/Quiz View
            mv.question_ids,
            mv.option_ids,
            -- Resource IDs - Both Views
            mv.image_ids,
            mv.video_ids,
            mv.document_ids,
            -- Rubric/Grade resource IDs
            mv.standard_group_ids,
            mv.standard_ids
        FROM mv_data mv
    ),
    -- Aggregate into array
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    chat_id,
                    attempt_id,
                    group_id,
                    scenario_id,
                    rubric_id,
                    problem_statement_id,
                    copy_paste_allowed,
                    text_enabled,
                    audio_enabled,
                    hints_enabled,
                    show_images,
                    show_objectives,
                    show_problem_statement,
                    time_limit_seconds,
                    negative,
                    created_at,
                    completed,
                    grade,
                    persona_ids,
                    objective_ids,
                    question_ids,
                    option_ids,
                    image_ids,
                    video_ids,
                    document_ids,
                    standard_group_ids,
                    standard_ids
                )::types.q_get_attempt_chats_view_v4_item
                ORDER BY created_at
            ),
            ARRAY[]::types.q_get_attempt_chats_view_v4_item[]
        ) AS items
        FROM with_resources
    )
    SELECT items FROM items_agg;
$$;
