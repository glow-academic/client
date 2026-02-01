-- ============================================================================
-- Query: get_simulation_chats_view
-- Purpose: Fetch chat-level data from mv_simulation_chats with resource JOINs
-- Section: VIEWS/SIMULATION/CHATS
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
        WHERE proname = 'api_get_simulation_chats_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_chats_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_simulation_chats_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

-- Feedback item type
CREATE TYPE types.q_get_simulation_chats_view_v4_feedback AS (
    id uuid,
    standard_id uuid,
    standard_name text,
    total float,
    feedback text
);

-- Main chat item type
CREATE TYPE types.q_get_simulation_chats_view_v4_item AS (
    -- Primary key
    chat_id uuid,

    -- Foreign keys
    attempt_id uuid,

    -- Resource IDs
    scenario_id uuid,
    persona_id uuid,
    rubric_id uuid,

    -- Resource metadata (JOINed)
    scenario_name text,
    persona_name text,
    persona_color text,
    persona_icon text,
    rubric_name text,
    objective text,
    problem_statement text,

    -- Practice flag
    practice boolean,

    -- Chat-level flags (directly from MV)
    copy_paste_allowed boolean,
    text_enabled boolean,
    audio_enabled boolean,
    hints_enabled boolean,
    show_images boolean,
    show_objectives boolean,
    show_problem_statement boolean,

    -- Chat data
    chat_created_at timestamptz,
    chat_completed boolean,
    chat_position int,
    is_current_chat boolean,

    -- Grade data
    grade_id uuid,
    grade_score float,
    grade_passed boolean,
    grade_description text,
    grade_time_taken int,
    rubric_total_points int,
    rubric_pass_points int,

    -- Feedbacks
    feedbacks types.q_get_simulation_chats_view_v4_feedback[]
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_simulation_chats_view_v4(
    attempt_id_filter uuid DEFAULT NULL,
    chat_ids uuid[] DEFAULT NULL,
    practice_filter boolean DEFAULT NULL
)
RETURNS TABLE (
    items types.q_get_simulation_chats_view_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
    WITH
    -- Parameter normalization
    params AS (
        SELECT
            attempt_id_filter AS attempt_id_filter,
            COALESCE(chat_ids, ARRAY[]::uuid[]) AS chat_ids,
            practice_filter AS practice_filter
    ),
    -- Fetch from MV with filters
    mv_data AS (
        SELECT mv.*
        FROM mv_simulation_chats mv, params p
        WHERE (p.attempt_id_filter IS NULL OR mv.attempt_id = p.attempt_id_filter)
          AND (CARDINALITY(p.chat_ids) = 0 OR mv.chat_id = ANY(p.chat_ids))
          AND (p.practice_filter IS NULL OR mv.practice = p.practice_filter)
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
                    )::types.q_get_simulation_chats_view_v4_feedback
                    ORDER BY (f).id
                ) FILTER (WHERE (f).id IS NOT NULL),
                ARRAY[]::types.q_get_simulation_chats_view_v4_feedback[]
            ) AS feedbacks
        FROM mv_data mv
        LEFT JOIN LATERAL unnest(mv.feedbacks) AS f ON true
        LEFT JOIN standards_resource std ON std.id = (f).standard_id AND std.active = TRUE
        GROUP BY mv.chat_id
    ),
    -- JOIN resource metadata
    with_resources AS (
        SELECT
            mv.chat_id,
            mv.attempt_id,
            mv.scenario_id,
            mv.persona_id,
            mv.rubric_id,
            -- Resource names (denormalized on _resource tables)
            scen.name AS scenario_name,
            pers.name AS persona_name,
            pers.color AS persona_color,
            pers.icon AS persona_icon,
            rub.name AS rubric_name,
            obj.objective AS objective,
            ps.problem_statement AS problem_statement,
            -- Flags
            mv.practice,
            -- Chat-level flags (directly from MV)
            mv.copy_paste_allowed,
            mv.text_enabled,
            mv.audio_enabled,
            mv.hints_enabled,
            mv.show_images,
            mv.show_objectives,
            mv.show_problem_statement,
            -- Chat data
            mv.chat_created_at,
            mv.chat_completed,
            mv.chat_position,
            mv.is_current_chat,
            -- Grade data
            mv.grade_id,
            mv.grade_score,
            mv.grade_passed,
            mv.grade_description,
            mv.grade_time_taken,
            mv.rubric_total_points,
            mv.rubric_pass_points,
            -- Feedbacks
            ft.feedbacks
        FROM mv_data mv
        LEFT JOIN scenarios_resource scen ON scen.id = mv.scenario_id AND scen.active = TRUE
        LEFT JOIN personas_resource pers ON pers.id = mv.persona_id AND pers.active = TRUE
        LEFT JOIN rubrics_resource rub ON rub.id = mv.rubric_id AND rub.active = TRUE
        LEFT JOIN scenario_objectives_junction soj ON soj.scenario_id = mv.scenario_id
        LEFT JOIN objectives_resource obj ON obj.id = soj.objective_id AND obj.active = TRUE
        LEFT JOIN scenario_problem_statements_junction spj ON spj.scenario_id = mv.scenario_id
        LEFT JOIN problem_statements_resource ps ON ps.id = spj.problem_statement_id AND ps.active = TRUE
        LEFT JOIN feedbacks_transformed ft ON ft.chat_id = mv.chat_id
    ),
    -- Aggregate into array
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    chat_id,
                    attempt_id,
                    scenario_id,
                    persona_id,
                    rubric_id,
                    scenario_name,
                    persona_name,
                    persona_color,
                    persona_icon,
                    rubric_name,
                    objective,
                    problem_statement,
                    practice,
                    copy_paste_allowed,
                    text_enabled,
                    audio_enabled,
                    hints_enabled,
                    show_images,
                    show_objectives,
                    show_problem_statement,
                    chat_created_at,
                    chat_completed,
                    chat_position,
                    is_current_chat,
                    grade_id,
                    grade_score,
                    grade_passed,
                    grade_description,
                    grade_time_taken,
                    rubric_total_points,
                    rubric_pass_points,
                    feedbacks
                )::types.q_get_simulation_chats_view_v4_item
                ORDER BY chat_position
            ),
            ARRAY[]::types.q_get_simulation_chats_view_v4_item[]
        ) AS items
        FROM with_resources
    )
    SELECT items FROM items_agg;
$$;
