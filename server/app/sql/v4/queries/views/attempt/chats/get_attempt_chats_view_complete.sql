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

-- Feedback item type
CREATE TYPE types.q_get_attempt_chats_view_v4_feedback AS (
    id uuid,
    standard_id uuid,
    standard_name text,
    total float,
    feedback text
);

-- Response item type (matches types.mv_response from MV - no response_id)
CREATE TYPE types.q_get_attempt_chats_view_v4_response AS (
    question_id uuid,
    option_id uuid,
    completed boolean,
    created_at timestamptz
);

-- Grade composite type (no grade_id - not a resource, no rubric points - fetched via rubric handler)
CREATE TYPE types.q_get_attempt_chats_view_v4_grade AS (
    score float,
    passed boolean,
    time_taken int
);

-- Analysis item type
CREATE TYPE types.q_get_attempt_chats_view_v4_analysis AS (
    content text
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

    -- Feedbacks (with standard name JOINed)
    feedbacks types.q_get_attempt_chats_view_v4_feedback[],

    -- Analyses (chat-level analysis content)
    analyses types.q_get_attempt_chats_view_v4_analysis[],

    -- Resource IDs - Normal/General View (plural arrays)
    persona_ids uuid[],
    objective_ids uuid[],

    -- Resource IDs - Video/Quiz View (plural arrays)
    question_ids uuid[],
    option_ids uuid[],
    responses types.q_get_attempt_chats_view_v4_response[],

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
    -- Transform feedbacks with standard names
    feedbacks_transformed AS (
        SELECT
            mv.chat_id,
            COALESCE(
                ARRAY_AGG(
                    (
                        (f).id,
                        (f).standard_id,
                        std.name,
                        (f).total,
                        (f).feedback
                    )::types.q_get_attempt_chats_view_v4_feedback
                    ORDER BY (f).id
                ) FILTER (WHERE (f).id IS NOT NULL),
                ARRAY[]::types.q_get_attempt_chats_view_v4_feedback[]
            ) AS feedbacks
        FROM mv_data mv
        LEFT JOIN LATERAL unnest(mv.feedbacks) AS f ON true
        LEFT JOIN standards_resource std ON std.id = (f).standard_id AND std.active = TRUE
        GROUP BY mv.chat_id
    ),
    -- Transform responses to query type
    responses_transformed AS (
        SELECT
            mv.chat_id,
            COALESCE(
                ARRAY_AGG(
                    (
                        (r).question_id,
                        (r).option_id,
                        (r).completed,
                        (r).created_at
                    )::types.q_get_attempt_chats_view_v4_response
                    ORDER BY (r).created_at
                ) FILTER (WHERE (r).question_id IS NOT NULL),
                ARRAY[]::types.q_get_attempt_chats_view_v4_response[]
            ) AS responses
        FROM mv_data mv
        LEFT JOIN LATERAL unnest(mv.responses) AS r ON true
        GROUP BY mv.chat_id
    ),
    -- Transform analyses to query type
    analyses_transformed AS (
        SELECT
            mv.chat_id,
            COALESCE(
                ARRAY_AGG(
                    ROW((a).content)::types.q_get_attempt_chats_view_v4_analysis
                ) FILTER (WHERE (a).content IS NOT NULL),
                ARRAY[]::types.q_get_attempt_chats_view_v4_analysis[]
            ) AS analyses
        FROM mv_data mv
        LEFT JOIN LATERAL unnest(mv.analyses) AS a ON true
        GROUP BY mv.chat_id
    ),
    -- No resource JOINs needed - all metadata fetched via internal handlers
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
            (mv.grade_score, mv.grade_passed, mv.grade_time_taken)::types.q_get_attempt_chats_view_v4_grade AS grade,
            -- Feedbacks
            ft.feedbacks,
            -- Analyses
            at.analyses,
            -- Resource IDs - Normal/General View
            mv.persona_ids,
            mv.objective_ids,
            -- Resource IDs - Video/Quiz View
            mv.question_ids,
            mv.option_ids,
            rt.responses,
            -- Resource IDs - Both Views
            mv.image_ids,
            mv.video_ids,
            mv.document_ids,
            -- Rubric/Grade resource IDs
            mv.standard_group_ids,
            mv.standard_ids
        FROM mv_data mv
        LEFT JOIN feedbacks_transformed ft ON ft.chat_id = mv.chat_id
        LEFT JOIN responses_transformed rt ON rt.chat_id = mv.chat_id
        LEFT JOIN analyses_transformed at ON at.chat_id = mv.chat_id
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
                    feedbacks,
                    analyses,
                    persona_ids,
                    objective_ids,
                    question_ids,
                    option_ids,
                    responses,
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
