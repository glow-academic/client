-- Get simulation attempt full details with all related entities
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_simulation_attempt_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_attempt_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- Drop in reverse dependency order: drop types that depend on other types first
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
    max_iterations int := 10;
    iteration int := 0;
    types_dropped int;
BEGIN
    -- Iteratively drop types until all are dropped or max iterations reached
    -- This handles circular dependencies by dropping types that can be dropped
    LOOP
        iteration := iteration + 1;
        types_dropped := 0;
        
        FOR r IN 
            SELECT typname 
            FROM pg_type 
            WHERE typname LIKE 'q_get_simulation_attempt_v4_%'
              AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
            ORDER BY typname DESC  -- Reverse alphabetical helps with dependencies
        LOOP
            BEGIN
                EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
                types_dropped := types_dropped + 1;
            EXCEPTION WHEN OTHERS THEN
                -- Type has dependencies, skip for now and try again in next iteration
                NULL;
            END;
        END LOOP;
        
        -- If no types were dropped this iteration, we're done (or stuck)
        EXIT WHEN types_dropped = 0 OR iteration >= max_iterations;
    END LOOP;
END $$;

-- 3) Recreate types
-- Core types
CREATE TYPE types.q_get_simulation_attempt_v4_attempt AS (
    id uuid,
    created_at timestamptz,
    simulation_id uuid,
    infinite_mode boolean,
    archived boolean,
    profile_id uuid
);

CREATE TYPE types.q_get_simulation_attempt_v4_simulation AS (
    id uuid,
    title text,
    description text,
    department_id uuid,
    active boolean,
    default_simulation boolean,
    practice_simulation boolean,
    hints_enabled boolean,
    objectives_enabled boolean,
    input_guardrail_active boolean,
    output_guardrail_active boolean,
    image_input_active boolean,
    copy_paste_allowed boolean,
    time_limit int,
    rubric_id uuid,
    created_at timestamptz,
    updated_at timestamptz
);

CREATE TYPE types.q_get_simulation_attempt_v4_attempt_profile AS (
    profile_id uuid,
    attempt_id uuid,
    active boolean
);

CREATE TYPE types.q_get_simulation_attempt_v4_timer AS (
    elapsed int,
    "limit" int,
    exceeded boolean,
    formatted text
);

CREATE TYPE types.q_get_simulation_attempt_v4_aggregated_results AS (
    total_score float,
    total_possible_points float,
    percentage float,
    passed boolean,
    chats_completed int,
    total_chats int
);

-- Message feedback types
CREATE TYPE types.q_get_simulation_attempt_v4_message_feedback_replace AS (
    section text,
    replace text
);

CREATE TYPE types.q_get_simulation_attempt_v4_message_feedback_highlight AS (
    section text
);

CREATE TYPE types.q_get_simulation_attempt_v4_message_feedback AS (
    id uuid,
    name text,
    description text,
    replaces types.q_get_simulation_attempt_v4_message_feedback_replace[],
    highlights types.q_get_simulation_attempt_v4_message_feedback_highlight[]
);

CREATE TYPE types.q_get_simulation_attempt_v4_message AS (
    id uuid,
    created_at timestamptz,
    updated_at timestamptz,
    chat_id uuid,
    content text,
    type text,
    completed boolean,
    persona_id uuid,
    feedbacks types.q_get_simulation_attempt_v4_message_feedback[]
);

-- Hint types
CREATE TYPE types.q_get_simulation_attempt_v4_hint AS (
    simulation_message_id uuid,
    hint text,
    idx int,
    created_at timestamptz
);

CREATE TYPE types.q_get_simulation_attempt_v4_hints_by_message AS (
    message_id uuid,
    hints types.q_get_simulation_attempt_v4_hint[]
);

-- Grade types
CREATE TYPE types.q_get_simulation_attempt_v4_grade AS (
    id uuid,
    created_at timestamptz,
    simulation_chat_id uuid,
    rubric_id uuid,
    description text,
    passed boolean,
    score int,
    time_taken int
);

-- Grading state types (convert dicts to arrays)
CREATE TYPE types.q_get_simulation_attempt_v4_standard_achievement AS (
    standard_id uuid,
    achieved boolean
);

CREATE TYPE types.q_get_simulation_attempt_v4_standard_pass AS (
    standard_id uuid,
    passed boolean
);

CREATE TYPE types.q_get_simulation_attempt_v4_standard_feedback AS (
    standard_id uuid,
    feedback text
);

CREATE TYPE types.q_get_simulation_attempt_v4_grading_state AS (
    achieved_standards types.q_get_simulation_attempt_v4_standard_achievement[],
    passed_standards types.q_get_simulation_attempt_v4_standard_pass[],
    grade_description text,
    feedback_by_standard_id types.q_get_simulation_attempt_v4_standard_feedback[]
);

-- Dynamic rubric types (convert dicts to arrays)
CREATE TYPE types.q_get_simulation_attempt_v4_skill_score AS (
    skill_name text,
    score float
);

CREATE TYPE types.q_get_simulation_attempt_v4_skill_feedback AS (
    skill_name text,
    feedback text
);

CREATE TYPE types.q_get_simulation_attempt_v4_dynamic_rubric AS (
    chat_id uuid,
    score float,
    passed boolean,
    time_taken float,
    skill_scores types.q_get_simulation_attempt_v4_skill_score[],
    skill_feedbacks types.q_get_simulation_attempt_v4_skill_feedback[],
    total_possible_points float
);

-- Previous chat types
CREATE TYPE types.q_get_simulation_attempt_v4_previous_chat AS (
    chat_id uuid,
    attempt_id uuid,
    score float,
    passed boolean,
    created_at timestamptz,
    title text,
    time_taken float,
    total_possible_points float,
    percentage float
);

-- Persona types
CREATE TYPE types.q_get_simulation_attempt_v4_persona AS (
    id uuid,
    name text,
    icon text,
    color text
);

-- Scenario types
CREATE TYPE types.q_get_simulation_attempt_v4_scenario AS (
    id uuid,
    name text,
    problem_statement text,
    department_id uuid,
    active boolean,
    persona_id uuid,
    persona_name text,
    persona_icon text,
    persona_color text,
    created_at timestamptz,
    updated_at timestamptz,
    generated boolean,
    default_scenario boolean,
    copy_paste_allowed boolean,
    text_enabled boolean,
    audio_enabled boolean,
    show_problem_statement boolean,
    show_objectives boolean,
    show_images boolean,
    background_image uuid,
    objectives text[]
);

-- Video types
CREATE TYPE types.q_get_simulation_attempt_v4_option AS (
    id uuid,
    option_text text,
    type text,
    is_correct boolean
);

CREATE TYPE types.q_get_simulation_attempt_v4_question AS (
    id uuid,
    question_text text,
    type text,
    allow_multiple boolean,
    times int[],
    options types.q_get_simulation_attempt_v4_option[]
);

CREATE TYPE types.q_get_simulation_attempt_v4_video_document AS (
    id uuid,
    name text,
    description text,
    extension text,
    file_path text,
    mime_type text,
    upload_id uuid
);

CREATE TYPE types.q_get_simulation_attempt_v4_video AS (
    id uuid,
    title text,
    length_seconds int,
    upload_id uuid,
    video_documents types.q_get_simulation_attempt_v4_video_document[],
    questions types.q_get_simulation_attempt_v4_question[],
    show_image boolean
);

-- Quiz types
CREATE TYPE types.q_get_simulation_attempt_v4_quiz_response AS (
    question_id uuid,
    option_id uuid,
    completed boolean,
    created_at timestamptz
);

CREATE TYPE types.q_get_simulation_attempt_v4_quiz AS (
    id uuid,
    completed boolean,
    responses types.q_get_simulation_attempt_v4_quiz_response[]
);

-- Chat types
CREATE TYPE types.q_get_simulation_attempt_v4_chat AS (
    id uuid,
    created_at timestamptz,
    updated_at timestamptz,
    title text,
    scenario_id uuid,
    parent_scenario_id uuid,
    attempt_id uuid,
    completed boolean,
    completed_at timestamptz,
    trace_id text,
    document_ids text[]
);

CREATE TYPE types.q_get_simulation_attempt_v4_chat_data AS (
    chat types.q_get_simulation_attempt_v4_chat,
    scenario types.q_get_simulation_attempt_v4_scenario,
    messages types.q_get_simulation_attempt_v4_message[],
    hints types.q_get_simulation_attempt_v4_hints_by_message[],
    grade types.q_get_simulation_attempt_v4_grade,
    grading_state types.q_get_simulation_attempt_v4_grading_state,
    dynamic_rubric types.q_get_simulation_attempt_v4_dynamic_rubric,
    previous_chats types.q_get_simulation_attempt_v4_previous_chat[],
    personas types.q_get_simulation_attempt_v4_persona[],
    content_type text,
    video types.q_get_simulation_attempt_v4_video,
    quiz types.q_get_simulation_attempt_v4_quiz
);

-- Document types
CREATE TYPE types.q_get_simulation_attempt_v4_scenario_document AS (
    document_id uuid,
    name text,
    type text,
    updated_at timestamptz,
    extension text,
    scenario_ids text[],
    can_edit boolean,
    can_delete boolean,
    active boolean,
    department_ids text[],
    file_path text,
    mime_type text,
    upload_id uuid,
    field_ids text[]
);

-- Rubric structure types (convert dicts to arrays)
CREATE TYPE types.q_get_simulation_attempt_v4_standard_group_mapping AS (
    standard_group_id uuid,
    name text,
    description text,
    points float,
    pass_points float
);

CREATE TYPE types.q_get_simulation_attempt_v4_standard_mapping AS (
    standard_id uuid,
    name text,
    description text,
    points float
);

CREATE TYPE types.q_get_simulation_attempt_v4_standard_group_standards AS (
    standard_group_id uuid,
    standard_ids text[]
);

CREATE TYPE types.q_get_simulation_attempt_v4_rubric_structure AS (
    standard_groups types.q_get_simulation_attempt_v4_standard_group_standards[],
    standard_groups_mapping types.q_get_simulation_attempt_v4_standard_group_mapping[],
    standards_mapping types.q_get_simulation_attempt_v4_standard_mapping[]
);

-- Continuation option types
CREATE TYPE types.q_get_simulation_attempt_v4_continuation_option AS (
    scenario_id uuid,
    position int,
    scenario_name text,
    previous_chat_id uuid,
    title text,
    score float,
    percentage float,
    time_taken float
);

CREATE TYPE types.q_get_simulation_attempt_v4_available_continuation_options AS (
    next_sequential_options types.q_get_simulation_attempt_v4_continuation_option[],
    has_options boolean
);

-- All simulation scenario types
CREATE TYPE types.q_get_simulation_attempt_v4_all_simulation_scenario AS (
    id uuid,
    name text,
    problem_statement text,
    department_id uuid,
    active boolean,
    persona_id uuid,
    persona_name text,
    persona_icon text,
    persona_color text,
    created_at timestamptz,
    updated_at timestamptz,
    generated boolean,
    default_scenario boolean,
    copy_paste_allowed boolean,
    text_enabled boolean,
    audio_enabled boolean,
    show_problem_statement boolean,
    show_objectives boolean,
    show_images boolean,
    background_image uuid,
    objectives text[],
    previous_chats types.q_get_simulation_attempt_v4_previous_chat[]
);

-- Feedback type (for feedbacks table)
CREATE TYPE types.q_get_simulation_attempt_v4_feedback AS (
    id uuid,
    created_at timestamptz,
    standard_id uuid,
    grade_id uuid,
    total float,
    feedback text
);

-- Standard type (for standards_list in rubric_standards_grouped)
CREATE TYPE types.q_get_simulation_attempt_v4_standard AS (
    id uuid,
    name text,
    points float,
    standard_group_id uuid
);

-- Role-based access control: check if viewing profile's role is higher than current user's role
CREATE TYPE types.q_get_simulation_attempt_v4_role_check AS (
    access_denied boolean,
    attempt_profile_role text,
    current_user_role text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_simulation_attempt_v4(
    attempt_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    attempt_exists boolean,
    actor_name text,
    access_denied boolean,
    attempt types.q_get_simulation_attempt_v4_attempt,
    simulation types.q_get_simulation_attempt_v4_simulation,
    attempt_profiles types.q_get_simulation_attempt_v4_attempt_profile[],
    chats types.q_get_simulation_attempt_v4_chat_data[],
    scenario_documents types.q_get_simulation_attempt_v4_scenario_document[],
    aggregated_results types.q_get_simulation_attempt_v4_aggregated_results,
    timer types.q_get_simulation_attempt_v4_timer,
    current_chat_index int,
    expected_chat_count int,
    is_single_chat_attempt boolean,
    is_last_attempt boolean,
    show_results boolean,
    should_show_controls boolean,
    remaining_scenarios_count int,
    is_last_remaining_scenario boolean,
    can_pick_multiple_alternatives boolean,
    is_active boolean,
    rubric_structure types.q_get_simulation_attempt_v4_rubric_structure,
    all_simulation_scenarios types.q_get_simulation_attempt_v4_all_simulation_scenario[],
    available_continuation_options types.q_get_simulation_attempt_v4_available_continuation_options
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        attempt_id AS attempt_id,
        profile_id AS profile_id
),
attempt_exists_check AS (
    SELECT EXISTS(
        SELECT 1 FROM simulation_attempts WHERE id = (SELECT attempt_id FROM params)
    )::boolean as attempt_exists
),
actor_profile AS (
    SELECT
        p.id as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
attempt_base AS (
    SELECT 
        sa.id,
        sa.created_at,
        sa.simulation_id,
        sa.infinite_mode,
        sa.archived,
        s.id as sim_id,
        s.title as sim_title,
        s.description as sim_description,
        (SELECT department_id FROM simulation_departments sd WHERE sd.simulation_id = s.id AND sd.active = true ORDER BY sd.created_at LIMIT 1) as sim_department_id,
        s.active as sim_active,
        s.practice_simulation as sim_practice_simulation,
        COALESCE(
            (SELECT SUM(stl.time_limit_seconds)::int
             FROM scenario_time_limits stl
             JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
             WHERE stl.simulation_id = s.id AND stl.active = true AND ss.active = true),
            0
        )::int as sim_time_limit,
        (SELECT rga.rubric_id FROM simulation_scenarios ss 
         JOIN simulation_scenarios_rubric_grade_agents ssrga ON ssrga.simulation_id = ss.simulation_id AND ssrga.scenario_id = ss.scenario_id
         JOIN rubric_grade_agents rga ON rga.id = ssrga.rubric_grade_agent_id
         WHERE ss.simulation_id = s.id AND ss.active = true 
         ORDER BY ss.position 
         LIMIT 1) as sim_rubric_id,
        s.created_at as sim_created_at,
        s.updated_at as sim_updated_at
    FROM params x
    JOIN simulation_attempts sa ON sa.id = x.attempt_id
    JOIN simulations s ON s.id = sa.simulation_id
),
attempt_profiles_data AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (ap.profile_id, ap.attempt_id, ap.active)::types.q_get_simulation_attempt_v4_attempt_profile
            ORDER BY ap.created_at
        ),
        '{}'::types.q_get_simulation_attempt_v4_attempt_profile[]
    ) as attempt_profiles
    FROM params x
    JOIN attempt_profiles ap ON ap.attempt_id = x.attempt_id
),
current_attempt_profile AS (
    SELECT ap.profile_id
    FROM params x
    JOIN attempt_profiles ap ON ap.attempt_id = x.attempt_id AND ap.active = true
    LIMIT 1
),
-- Role-based access control: check if viewing profile's role is higher than current user's role
role_check AS (
    SELECT 
        CASE 
            WHEN cap.profile_id IS NOT NULL AND x.profile_id IS NOT NULL THEN
                CASE 
                    WHEN attempt_role_level > current_role_level THEN true
                    ELSE false
                END
            ELSE false
        END as access_denied,
        attempt_role::text as attempt_profile_role,
        current_role::text as current_user_role
    FROM params x
    CROSS JOIN current_attempt_profile cap
    CROSS JOIN LATERAL (
        SELECT role::text as attempt_role,
            CASE 
                WHEN role::text = 'superadmin' THEN 5
                WHEN role::text = 'admin' THEN 4
                WHEN role::text = 'instructional' THEN 3
                WHEN role::text = 'member' THEN 2
                ELSE 1
            END as attempt_role_level
        FROM profiles
        WHERE id = cap.profile_id
    ) attempt_profile_role_info
    CROSS JOIN LATERAL (
        SELECT role::text as current_role,
            CASE 
                WHEN role::text = 'superadmin' THEN 5
                WHEN role::text = 'admin' THEN 4
                WHEN role::text = 'instructional' THEN 3
                WHEN role::text = 'member' THEN 2
                ELSE 1
            END as current_role_level
        FROM profiles
        WHERE id = x.profile_id
    ) current_user_role_info
),
simulation_scenarios_list AS (
    SELECT ss.scenario_id, ss.position
    FROM params x
    JOIN attempt_base ab ON ab.id = x.attempt_id
    JOIN simulation_scenarios ss ON ss.simulation_id = ab.simulation_id AND ss.active = true
    ORDER BY ss.position
),
chat_ids_list AS (
    SELECT array_agg(id) as chat_ids
    FROM (
        SELECT sc.id
        FROM params x
        JOIN attempt_chats ac ON ac.attempt_id = x.attempt_id
        JOIN chats sc ON sc.id = ac.chat_id
        ORDER BY sc.created_at
    ) chats_base
),
scenario_ids_list AS (
    SELECT array_agg(DISTINCT scenario_id) as scenario_ids
    FROM (
        SELECT sc.scenario_id
        FROM params x
        JOIN attempt_chats ac ON ac.attempt_id = x.attempt_id
        JOIN chats sc ON sc.id = ac.chat_id
    ) chats_base
),
chats_base AS (
    SELECT 
        sc.id,
        sc.created_at,
        sc.updated_at,
        sc.title,
        sc.scenario_id,
        ac.attempt_id,
        sc.completed,
        g.trace_id,
        COALESCE(
            (SELECT array_agg(DISTINCT sd.document_id::text)
             FROM scenario_documents sd
             WHERE sd.scenario_id = sc.scenario_id AND sd.active = true),
            ARRAY[]::text[]
        ) as document_ids
    FROM params x
    JOIN attempt_chats ac ON ac.attempt_id = x.attempt_id
    JOIN chats sc ON sc.id = ac.chat_id
    LEFT JOIN chat_groups cg ON cg.chat_id = sc.id
    LEFT JOIN groups g ON g.id = cg.group_id
    ORDER BY sc.created_at
),
-- Get scenario videos and questions (videos now accessed through scenarios)
scenario_videos_with_questions AS (
    SELECT 
        sv.scenario_id,
        v.id as video_id,
        v.name as video_title,
        v.length_seconds,
        vu.upload_id,
        COALESCE(
            (SELECT ARRAY_AGG(
                (q.id, q.question_text, 'choice'::text, q.allow_multiple,
                 COALESCE(
                     (SELECT ARRAY_AGG(sqt.time ORDER BY sqt.time)
                      FROM scenario_question_times sqt
                      WHERE sqt.scenario_id = sv.scenario_id 
                        AND sqt.question_id = q.id 
                        AND sqt.video_id = v.id
                        AND sqt.active = true),
                     ARRAY[]::int[]
                 ),
                 COALESCE(
                     (SELECT ARRAY_AGG(
                         (o.id, o.option_text, o.type::text, CASE WHEN qa.option_id IS NOT NULL THEN true ELSE false END)::types.q_get_simulation_attempt_v4_option
                         ORDER BY o.id
                     )
                     FROM question_options qo
                     JOIN options o ON o.id = qo.option_id AND o.active = true
                     LEFT JOIN question_answers qa ON qa.question_id = q.id AND qa.option_id = o.id AND qa.active = true
                     WHERE qo.question_id = q.id AND qo.active = true),
                     '{}'::types.q_get_simulation_attempt_v4_option[]
                 )
                )::types.q_get_simulation_attempt_v4_question
                ORDER BY sq.created_at
            )
            FROM scenario_questions sq
            JOIN questions q ON q.id = sq.question_id
            WHERE sq.scenario_id = sv.scenario_id AND sq.active = true AND q.active = true),
            '{}'::types.q_get_simulation_attempt_v4_question[]
        ) as questions
    FROM scenario_videos sv
    JOIN videos v ON v.id = sv.video_id
    LEFT JOIN video_uploads vu ON vu.video_id = v.id AND vu.active = true
    WHERE sv.active = true AND v.active = true
),
-- Note: Quizzes are deprecated - questions are now handled directly through scenarios
attempt_quizzes_data AS (
    SELECT 
        q.id as quiz_id,
        q.video_id,
        q.completed as quiz_completed,
        q.created_at as quiz_created_at,
        q.updated_at as quiz_updated_at
    FROM params x
    JOIN attempt_quizzes aq ON aq.attempt_id = x.attempt_id
    JOIN quizzes q ON q.id = aq.quiz_id
),
quiz_responses_data AS (
    SELECT 
        qr.quiz_id,
        qr.question_id,
        qr.option_id,
        qr.completed as response_completed,
        qr.created_at as response_created_at
    FROM quiz_responses qr
    WHERE qr.quiz_id IN (SELECT quiz_id FROM attempt_quizzes_data)
),
quiz_responses_grouped AS (
    SELECT 
        qr.quiz_id,
        COALESCE(
            ARRAY_AGG(
                (qr.question_id, qr.option_id, qr.response_completed, qr.response_created_at)::types.q_get_simulation_attempt_v4_quiz_response
                ORDER BY qr.response_created_at
            ),
            '{}'::types.q_get_simulation_attempt_v4_quiz_response[]
        ) as responses
    FROM quiz_responses_data qr
    GROUP BY qr.quiz_id
),
simulation_root_scenarios_list AS (
    SELECT DISTINCT
        ss.scenario_id as root_scenario_id,
        ss.position
    FROM params x
    JOIN attempt_base ab ON ab.id = x.attempt_id
    JOIN simulation_scenarios ss ON ss.simulation_id = ab.simulation_id AND ss.active = true
    ORDER BY ss.position
),
-- Recursively map all child scenarios to their root parent scenarios
scenario_root_mapping AS (
    WITH RECURSIVE scenario_ancestors AS (
        SELECT DISTINCT
            sc.scenario_id as child_scenario_id,
            sc.scenario_id as ancestor_id,
            0 as depth
        FROM params x
        JOIN chats sc ON EXISTS (
            SELECT 1 FROM attempt_chats ac WHERE ac.chat_id = sc.id AND ac.attempt_id = x.attempt_id
        )
        
        UNION ALL
        
        SELECT 
            sa.child_scenario_id,
            COALESCE(
                (SELECT st.parent_id 
                 FROM scenario_tree st 
                 WHERE st.child_id = sa.ancestor_id 
                   AND st.parent_id != st.child_id 
                 LIMIT 1),
                sa.ancestor_id
            ) as ancestor_id,
            sa.depth + 1 as depth
        FROM scenario_ancestors sa
        WHERE sa.depth < 100
          AND EXISTS (
              SELECT 1 FROM scenario_tree st 
              WHERE st.child_id = sa.ancestor_id 
                AND st.parent_id != st.child_id
          )
    )
    SELECT DISTINCT
        child_scenario_id,
        ancestor_id as root_scenario_id
    FROM scenario_ancestors
    WHERE depth = (
        SELECT MAX(depth) 
        FROM scenario_ancestors sa2 
        WHERE sa2.child_scenario_id = scenario_ancestors.child_scenario_id
    )
),
-- Recursively map previous chat scenarios to their root parent scenarios
previous_chat_scenario_root_mapping AS (
    WITH RECURSIVE scenario_ancestors AS (
        SELECT DISTINCT
            sc.scenario_id as child_scenario_id,
            sc.scenario_id as ancestor_id,
            0 as depth
        FROM params x
        CROSS JOIN current_attempt_profile cap
        JOIN chats sc ON EXISTS (
            SELECT 1 FROM attempt_chats ac2
            JOIN simulation_attempts sa2 ON sa2.id = ac2.attempt_id
            JOIN attempt_profiles ap2 ON ap2.attempt_id = sa2.id AND ap2.active = true
            WHERE ac2.chat_id = sc.id
              AND ap2.profile_id = cap.profile_id
              AND sc.completed = true
              AND EXISTS (
                  SELECT 1 FROM grades scg 
                  JOIN runs r ON r.id = scg.run_id
                  JOIN group_runs gr ON gr.run_id = r.id
                  JOIN groups g ON g.id = gr.group_id
                  JOIN chat_groups cg ON cg.group_id = g.id
                  JOIN chats c ON c.id = cg.chat_id
                  WHERE c.id = sc.id 
                    AND EXISTS (
                        SELECT 1 FROM runs r_check
                        JOIN group_runs gr_check ON gr_check.run_id = r_check.id
                        JOIN groups g_check ON g_check.id = gr_check.group_id
                        JOIN chat_groups cg_check ON cg_check.group_id = g_check.id
                        JOIN chats c_check ON c_check.id = cg_check.chat_id
                        WHERE r_check.id = scg.run_id
                    )
              )
              AND ac2.attempt_id != x.attempt_id
        )
        
        UNION ALL
        
        SELECT 
            sa.child_scenario_id,
            COALESCE(
                (SELECT st.parent_id 
                 FROM scenario_tree st 
                 WHERE st.child_id = sa.ancestor_id 
                   AND st.parent_id != st.child_id 
                 LIMIT 1),
                sa.ancestor_id
            ) as ancestor_id,
            sa.depth + 1 as depth
        FROM scenario_ancestors sa
        WHERE sa.depth < 100
          AND EXISTS (
              SELECT 1 FROM scenario_tree st 
              WHERE st.child_id = sa.ancestor_id 
                AND st.parent_id != st.child_id
          )
    )
    SELECT DISTINCT
        child_scenario_id,
        ancestor_id as root_scenario_id
    FROM scenario_ancestors
    WHERE depth = (
        SELECT MAX(depth) 
        FROM scenario_ancestors sa2 
        WHERE sa2.child_scenario_id = scenario_ancestors.child_scenario_id
    )
),
-- Find previous completed chats from other attempts by same profile
previous_chats_with_grades AS (
    SELECT DISTINCT ON (sc.id)
        sc.id as chat_id,
        sc.scenario_id as child_scenario_id,
        COALESCE(
            (SELECT pcsrm.root_scenario_id 
             FROM previous_chat_scenario_root_mapping pcsrm 
             WHERE pcsrm.child_scenario_id = sc.scenario_id),
            sc.scenario_id
        ) as parent_scenario_id,
        ac2.attempt_id,
        sa2.simulation_id,
        sc.title,
        sc.created_at,
        scg.score,
        scg.passed,
        COALESCE(conv.time_taken, 0) as time_taken
    FROM params x
    CROSS JOIN current_attempt_profile cap
    CROSS JOIN simulation_scenarios_list ssl
    CROSS JOIN attempt_base ab
    JOIN chats sc ON EXISTS (
        SELECT 1 FROM attempt_chats ac2
        JOIN simulation_attempts sa2 ON sa2.id = ac2.attempt_id
        JOIN attempt_profiles ap2 ON ap2.attempt_id = sa2.id AND ap2.active = true
        WHERE ac2.chat_id = sc.id
          AND ap2.profile_id = cap.profile_id
          AND sc.completed = true
          AND EXISTS (
              SELECT 1 FROM grades scg 
              JOIN runs r ON r.id = scg.run_id
              JOIN group_runs gr ON gr.run_id = r.id
              JOIN groups g ON g.id = gr.group_id
              JOIN chat_groups cg ON cg.group_id = g.id
              JOIN chats c ON c.id = cg.chat_id
              WHERE c.id = sc.id
          )
          AND ac2.attempt_id != x.attempt_id
          AND ab.sim_practice_simulation = false
    )
    JOIN attempt_chats ac2 ON EXISTS (
        SELECT 1 FROM chats c_check WHERE c_check.id = sc.id
    ) AND EXISTS (
        SELECT 1 FROM simulation_attempts sa_check WHERE sa_check.id = ac2.attempt_id
    )
    JOIN simulation_attempts sa2 ON sa2.id = ac2.attempt_id
    JOIN attempt_profiles ap2 ON ap2.attempt_id = sa2.id AND ap2.active = true
    LEFT JOIN grades scg ON EXISTS (
        SELECT 1 FROM runs r_check
        JOIN group_runs gr_check ON gr_check.run_id = r_check.id
        JOIN groups g_check ON g_check.id = gr_check.group_id
        JOIN chat_groups cg_check ON cg_check.group_id = g_check.id
        JOIN chats c_check ON c_check.id = cg_check.chat_id
        WHERE r_check.id = scg.run_id AND c_check.id = sc.id
    )
    LEFT JOIN grade_conversations gc ON gc.grade_id = scg.id
    LEFT JOIN conversations conv ON conv.id = gc.conversation_id
    WHERE ap2.profile_id = cap.profile_id
      AND sc.completed = true
      AND COALESCE(
            (SELECT pcsrm.root_scenario_id 
             FROM previous_chat_scenario_root_mapping pcsrm 
             WHERE pcsrm.child_scenario_id = sc.scenario_id),
            sc.scenario_id
        ) = ssl.scenario_id
      AND ac2.attempt_id != x.attempt_id
      AND ab.sim_practice_simulation = false
    ORDER BY sc.id, scg.created_at DESC NULLS LAST
),
previous_attempt_time_aggregation AS (
    SELECT 
        ac.attempt_id,
        COALESCE(SUM(COALESCE(conv.time_taken, 0)), 0)::integer as total_time_taken
    FROM previous_chats_with_grades pwg
    JOIN attempt_chats ac ON ac.attempt_id = pwg.attempt_id
    JOIN chats sc ON sc.id = ac.chat_id
    JOIN grades scg ON EXISTS (
        SELECT 1 FROM runs r_check
        JOIN group_runs gr_check ON gr_check.run_id = r_check.id
        JOIN groups g_check ON g_check.id = gr_check.group_id
        JOIN chat_groups cg_check ON cg_check.group_id = g_check.id
        JOIN chats c_check ON c_check.id = cg_check.chat_id
        WHERE r_check.id = scg.run_id AND c_check.id = sc.id
    )
    LEFT JOIN grade_conversations gc ON gc.grade_id = scg.id
    LEFT JOIN conversations conv ON conv.id = gc.conversation_id
    WHERE sc.completed = true
    GROUP BY ac.attempt_id
),
previous_attempt_rubric_points AS (
    SELECT DISTINCT ON (sa.simulation_id)
        sa.simulation_id,
        COALESCE(r.points, 0)::integer as total_points
    FROM previous_chats_with_grades pwg
    JOIN simulation_attempts sa ON sa.id = pwg.attempt_id
    JOIN simulations s ON s.id = sa.simulation_id
    LEFT JOIN simulation_scenarios ss_rubric ON ss_rubric.simulation_id = s.id AND ss_rubric.active = true
    LEFT JOIN simulation_scenarios_rubric_grade_agents ssrga_rubric ON ssrga_rubric.simulation_id = ss_rubric.simulation_id AND ssrga_rubric.scenario_id = ss_rubric.scenario_id
    LEFT JOIN rubric_grade_agents rga_rubric ON rga_rubric.id = ssrga_rubric.rubric_grade_agent_id
    LEFT JOIN rubrics r ON r.id = rga_rubric.rubric_id
    ORDER BY sa.simulation_id
),
previous_chats_for_scenarios AS (
    SELECT 
        pwg.parent_scenario_id as scenario_id,
        COALESCE(
            ARRAY_AGG(
                (pwg.chat_id, pwg.attempt_id, pwg.score::float, pwg.passed, pwg.created_at, pwg.title, 
                 COALESCE(pwg.time_taken, 0)::float, 
                 COALESCE(parp.total_points, 0)::float,
                 CASE 
                     WHEN pwg.score IS NOT NULL AND parp.total_points > 0 THEN
                         ROUND((pwg.score::numeric / parp.total_points::numeric) * 100.0)::float
                     ELSE NULL::float
                 END
                )::types.q_get_simulation_attempt_v4_previous_chat
                ORDER BY pwg.created_at DESC
            ),
            '{}'::types.q_get_simulation_attempt_v4_previous_chat[]
        ) as previous_chats
    FROM previous_chats_with_grades pwg
    LEFT JOIN previous_attempt_time_aggregation pat ON pat.attempt_id = pwg.attempt_id
    LEFT JOIN previous_attempt_rubric_points parp ON parp.simulation_id = pwg.simulation_id
    GROUP BY pwg.parent_scenario_id
),
scenario_background_images_for_simulation AS (
    SELECT DISTINCT ON (si.scenario_id)
        si.scenario_id,
        iu.upload_id as background_image_upload_id
    FROM params x
    JOIN attempt_base ab ON ab.id = x.attempt_id
    JOIN scenario_images si ON EXISTS (
        SELECT 1 FROM simulation_scenarios ss 
        WHERE ss.simulation_id = ab.simulation_id 
          AND ss.scenario_id = si.scenario_id 
          AND ss.active = true
    )
    JOIN images i ON i.id = si.image_id AND i.active = true
    LEFT JOIN image_uploads iu ON iu.image_id = i.id AND iu.active = true
    WHERE si.active = true
      AND iu.upload_id IS NOT NULL
    ORDER BY si.scenario_id, si.created_at ASC
),
all_simulation_scenarios_with_previous_chats AS (
    SELECT 
        ssl.scenario_id,
        ssl.position,
        (s.id, s.name, COALESCE(ps.problem_statement, ''),
         COALESCE((SELECT department_id FROM scenario_departments sd WHERE sd.scenario_id = s.id AND sd.active = true ORDER BY sd.created_at LIMIT 1), NULL::uuid),
         s.active,
         sp.persona_id,
         p.name,
         p.icon,
         p.color,
         s.created_at,
         s.updated_at,
         s.generated,
         false,
         COALESCE(ss.copy_paste_allowed, false),
         COALESCE(ss.text_enabled, true),
         COALESCE(ss.audio_enabled, false),
         COALESCE(ss.show_problem_statement, true),
         COALESCE(ss.show_objectives, true),
         COALESCE(ss.show_images, true),
         sbi.background_image_upload_id,
         COALESCE(
             (SELECT ARRAY_AGG(o.objective ORDER BY so.idx)
              FROM scenario_objectives so
              JOIN objectives o ON o.id = so.objective_id
              WHERE so.scenario_id = s.id),
             ARRAY[]::text[]
         )
        )::types.q_get_simulation_attempt_v4_scenario as scenario_data,
        COALESCE(pcf.previous_chats, '{}'::types.q_get_simulation_attempt_v4_previous_chat[]) as previous_chats
    FROM simulation_scenarios_list ssl
    LEFT JOIN simulation_scenarios ss ON ss.scenario_id = ssl.scenario_id AND ss.simulation_id = (SELECT simulation_id FROM attempt_base)
    LEFT JOIN scenarios s ON s.id = ssl.scenario_id
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
    LEFT JOIN scenario_personas sp ON sp.scenario_id = s.id AND sp.active = true
    LEFT JOIN personas p ON p.id = sp.persona_id
    LEFT JOIN scenario_background_images_for_simulation sbi ON sbi.scenario_id = s.id
    LEFT JOIN previous_chats_for_scenarios pcf ON pcf.scenario_id = ssl.scenario_id
    ORDER BY ssl.position
),
scenario_background_images_for_chats AS (
    SELECT DISTINCT ON (si.scenario_id)
        si.scenario_id,
        iu.upload_id as background_image_upload_id
    FROM scenario_images si
    JOIN images i ON i.id = si.image_id AND i.active = true
    LEFT JOIN image_uploads iu ON iu.image_id = i.id AND iu.active = true
    CROSS JOIN scenario_ids_list sil
    WHERE si.scenario_id = ANY(sil.scenario_ids) 
      AND si.active = true
      AND iu.upload_id IS NOT NULL
    ORDER BY si.scenario_id, si.created_at ASC
),
scenarios_data AS (
    SELECT 
        s.id,
        (s.id, s.name, COALESCE(ps.problem_statement, ''),
         COALESCE((SELECT department_id FROM scenario_departments sd WHERE sd.scenario_id = s.id AND sd.active = true ORDER BY sd.created_at LIMIT 1), NULL::uuid),
         s.active,
         sp.persona_id,
         p.name,
         p.icon,
         p.color,
         s.created_at,
         s.updated_at,
         s.generated,
         false,
         COALESCE(ss.copy_paste_allowed, false),
         COALESCE(ss.text_enabled, true),
         COALESCE(ss.audio_enabled, false),
         COALESCE(ss.show_problem_statement, true),
         COALESCE(ss.show_objectives, true),
         COALESCE(ss.show_images, true),
         sbi.background_image_upload_id,
         COALESCE(
             (SELECT ARRAY_AGG(o.objective ORDER BY so.idx)
              FROM scenario_objectives so
              JOIN objectives o ON o.id = so.objective_id
              WHERE so.scenario_id = s.id),
             ARRAY[]::text[]
         )
        )::types.q_get_simulation_attempt_v4_scenario as scenario_data,
        COALESCE(ss.hints_enabled, false) as hints_enabled,
        COALESCE(s.objectives_enabled, true) as objectives_enabled,
        COALESCE(s.images_enabled, false) as image_input_enabled,
        COALESCE(ss.copy_paste_allowed, false) as copy_paste_allowed
    FROM scenarios s
    CROSS JOIN scenario_ids_list sil
    CROSS JOIN attempt_base ab
    LEFT JOIN simulation_scenarios ss ON ss.scenario_id = s.id AND ss.simulation_id = ab.simulation_id
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
    LEFT JOIN scenario_personas sp ON sp.scenario_id = s.id AND sp.active = true
    LEFT JOIN personas p ON p.id = sp.persona_id
    LEFT JOIN scenario_background_images_for_chats sbi ON sbi.scenario_id = s.id
    WHERE s.id = ANY(sil.scenario_ids)
),
simulation_flags AS (
    SELECT 
        COALESCE((SELECT ss.hints_enabled FROM simulation_scenarios ss JOIN chats_base cb ON ss.scenario_id = cb.scenario_id CROSS JOIN attempt_base ab WHERE ss.simulation_id = ab.simulation_id ORDER BY cb.created_at LIMIT 1), false) as hints_enabled,
        COALESCE((SELECT s.objectives_enabled FROM simulation_scenarios ss JOIN chats_base cb ON ss.scenario_id = cb.scenario_id JOIN scenarios s ON s.id = ss.scenario_id CROSS JOIN attempt_base ab WHERE ss.simulation_id = ab.simulation_id ORDER BY cb.created_at LIMIT 1), true) as objectives_enabled,
        COALESCE((SELECT s.images_enabled FROM simulation_scenarios ss JOIN chats_base cb ON ss.scenario_id = cb.scenario_id JOIN scenarios s ON s.id = ss.scenario_id CROSS JOIN attempt_base ab WHERE ss.simulation_id = ab.simulation_id ORDER BY cb.created_at LIMIT 1), false) as image_input_enabled,
        COALESCE((SELECT ss.copy_paste_allowed FROM simulation_scenarios ss JOIN chats_base cb ON ss.scenario_id = cb.scenario_id CROSS JOIN attempt_base ab WHERE ss.simulation_id = ab.simulation_id ORDER BY cb.created_at LIMIT 1), false) as copy_paste_allowed
),
-- Tree traversal for messages: get all messages following conversation flow
messages_with_tree AS (
    WITH RECURSIVE message_path AS (
        SELECT 
            m.id, 
            c.id AS chat_id, 
            CASE WHEN m.role = 'user'::message_role THEN 'query' ELSE 'response' END as type, 
            cnt.content, 
            m.created_at, 
            m.completed, 
            m.updated_at,
            mp_persona.persona_id,
            0 as depth,
            m.id as path_root_id
        FROM chats c
        JOIN chat_groups cg ON cg.chat_id = c.id
        JOIN groups g ON g.id = cg.group_id
        JOIN group_runs gr ON gr.group_id = g.id
        JOIN runs r ON r.id = gr.run_id
        JOIN message_runs mr ON mr.run_id = r.id
        JOIN messages m ON m.id = mr.message_id
        LEFT JOIN message_content mc ON mc.message_id = m.id AND mc.idx = 0
        LEFT JOIN content cnt ON cnt.id = mc.content_id
        LEFT JOIN message_personas mp_persona ON mp_persona.message_id = m.id
        CROSS JOIN chat_ids_list cil
        WHERE c.id = ANY(cil.chat_ids)
          AND m.role IN ('user'::message_role, 'assistant'::message_role)
          AND NOT EXISTS (
              SELECT 1 FROM message_tree mt 
              WHERE mt.parent_id = m.id AND mt.active = true
          )
        
        UNION ALL
        
        SELECT 
            m.id, 
            mp.chat_id, 
            CASE WHEN m.role = 'user'::message_role THEN 'query' ELSE 'response' END as type, 
            cnt.content, 
            m.created_at, 
            m.completed, 
            m.updated_at,
            mp_persona.persona_id,
            mp.depth + 1 as depth,
            mp.path_root_id
        FROM messages m
        LEFT JOIN message_content mc ON mc.message_id = m.id AND mc.idx = 0
        LEFT JOIN content cnt ON cnt.id = mc.content_id
        JOIN message_tree mt ON mt.parent_id = m.id AND mt.active = true
        JOIN message_path mp ON mp.id = mt.child_id
        JOIN message_runs mr ON mr.message_id = m.id
        JOIN runs r ON r.id = mr.run_id
        JOIN group_runs gr ON gr.run_id = r.id
        JOIN groups g ON g.id = gr.group_id
        JOIN chat_groups cg ON cg.group_id = g.id
        JOIN chats c ON c.id = cg.chat_id
        LEFT JOIN message_personas mp_persona ON mp_persona.message_id = m.id
        CROSS JOIN chat_ids_list cil
        WHERE mp.depth < 1000
          AND m.role IN ('user'::message_role, 'assistant'::message_role)
          AND c.id = mp.chat_id
          AND c.id = ANY(cil.chat_ids)
    ),
    messages_without_parents AS (
        SELECT 
            m.id, 
            c.id AS chat_id, 
            CASE WHEN m.role = 'user'::message_role THEN 'query' ELSE 'response' END as type, 
            cnt.content, 
            m.created_at, 
            m.completed, 
            m.updated_at,
            mp_persona.persona_id,
            -1 as depth,
            m.id as path_root_id
        FROM chats c
        JOIN chat_groups cg ON cg.chat_id = c.id
        JOIN groups g ON g.id = cg.group_id
        JOIN group_runs gr ON gr.group_id = g.id
        JOIN runs r ON r.id = gr.run_id
        JOIN message_runs mr ON mr.run_id = r.id
        JOIN messages m ON m.id = mr.message_id
        LEFT JOIN message_content mc ON mc.message_id = m.id AND mc.idx = 0
        LEFT JOIN content cnt ON cnt.id = mc.content_id
        LEFT JOIN message_personas mp_persona ON mp_persona.message_id = m.id
        CROSS JOIN chat_ids_list cil
        WHERE c.id = ANY(cil.chat_ids)
          AND m.role IN ('user'::message_role, 'assistant'::message_role)
          AND NOT EXISTS (
              SELECT 1 FROM message_tree mt 
              WHERE mt.child_id = m.id AND mt.active = true
          )
          AND NOT EXISTS (
              SELECT 1 FROM message_path mp 
              WHERE mp.id = m.id
          )
    ),
    all_messages AS (
        SELECT * FROM message_path
        UNION ALL
        SELECT * FROM messages_without_parents
    )
    SELECT DISTINCT ON (id, chat_id)
        id,
        chat_id,
        type,
        content,
        created_at,
        completed,
        updated_at,
        persona_id
    FROM all_messages
    ORDER BY id, chat_id, created_at
),
grades_data AS (
    SELECT DISTINCT ON (c.id)
        c.id as chat_id,
        (scg.id, scg.created_at, c.id, rga.rubric_id, scg.description, scg.passed, scg.score, COALESCE(conv.time_taken, 0))::types.q_get_simulation_attempt_v4_grade as grade
    FROM params x
    JOIN chats c ON EXISTS (
        SELECT 1 FROM chat_groups cg2
        JOIN groups g2 ON g2.id = cg2.group_id
        JOIN group_runs gr2 ON gr2.group_id = g2.id
        JOIN runs r2 ON r2.id = gr2.run_id
        WHERE cg2.chat_id = c.id
    )
    CROSS JOIN chat_ids_list cil
    JOIN chat_groups cg ON cg.chat_id = c.id
    JOIN groups g ON g.id = cg.group_id
    JOIN group_runs gr ON gr.group_id = g.id
    JOIN runs r ON r.id = gr.run_id
    JOIN grades scg ON scg.run_id = r.id
    LEFT JOIN rubric_grade_agents rga ON rga.id = scg.rubric_grade_agent_id
    LEFT JOIN grade_conversations gc ON gc.grade_id = scg.id
    LEFT JOIN conversations conv ON conv.id = gc.conversation_id
    WHERE EXISTS (
        SELECT 1 FROM runs r_check
        JOIN group_runs gr_check ON gr_check.run_id = r_check.id
        JOIN groups g_check ON g_check.id = gr_check.group_id
        JOIN chat_groups cg_check ON cg_check.group_id = g_check.id
        JOIN chats c_check ON c_check.id = cg_check.chat_id
        WHERE r_check.id = scg.run_id AND c_check.id = c.id
    )
      AND c.id = ANY(cil.chat_ids)
    ORDER BY c.id, scg.created_at DESC
),
message_feedbacks_data AS (
    -- Strengths with highlights
    SELECT 
        mfs.message_id,
        mfs.grade_id,
        (mfs.id, mfs.name, mfs.description,
         '{}'::types.q_get_simulation_attempt_v4_message_feedback_replace[],
         COALESCE(
             (SELECT ARRAY_AGG((mfh.section)::types.q_get_simulation_attempt_v4_message_feedback_highlight ORDER BY mfh.idx)
                        FROM message_feedback_highlight mfh
                        WHERE mfh.message_feedback_id = mfs.id),
             '{}'::types.q_get_simulation_attempt_v4_message_feedback_highlight[]
         )
        )::types.q_get_simulation_attempt_v4_message_feedback as feedback_data
    FROM message_feedback_strengths mfs
    WHERE mfs.grade_id IN (SELECT (gd.grade).id FROM grades_data gd)
    UNION ALL
    -- Improvements with replaces
    SELECT 
        mfi.message_id,
        mfi.grade_id,
        (mfi.id, mfi.name, mfi.description,
         COALESCE(
             (SELECT ARRAY_AGG((mfr.section, mfr.replace)::types.q_get_simulation_attempt_v4_message_feedback_replace ORDER BY mfr.idx)
                        FROM message_feedback_replace mfr
                        WHERE mfr.message_feedback_id = mfi.id),
             '{}'::types.q_get_simulation_attempt_v4_message_feedback_replace[]
         ),
         '{}'::types.q_get_simulation_attempt_v4_message_feedback_highlight[]
        )::types.q_get_simulation_attempt_v4_message_feedback as feedback_data
    FROM message_feedback_improvements mfi
    WHERE mfi.grade_id IN (SELECT (gd.grade).id FROM grades_data gd)
),
message_feedbacks_grouped AS (
    SELECT 
        mfd.message_id,
        COALESCE(
            ARRAY_AGG(mfd.feedback_data ORDER BY (mfd.feedback_data).id),
            '{}'::types.q_get_simulation_attempt_v4_message_feedback[]
        ) as feedbacks
    FROM message_feedbacks_data mfd
    GROUP BY mfd.message_id
),
messages_grouped AS (
    SELECT 
        mwt.chat_id,
        COALESCE(
            ARRAY_AGG(
                (mwt.id, mwt.created_at, mwt.updated_at, mwt.chat_id, mwt.content, mwt.type, mwt.completed, mwt.persona_id,
                 COALESCE(mfg.feedbacks, '{}'::types.q_get_simulation_attempt_v4_message_feedback[])
                )::types.q_get_simulation_attempt_v4_message
                ORDER BY mwt.created_at
            ),
            '{}'::types.q_get_simulation_attempt_v4_message[]
        ) as messages
    FROM messages_with_tree mwt
    LEFT JOIN message_feedbacks_grouped mfg ON mfg.message_id = mwt.id
    GROUP BY mwt.chat_id
),
personas_per_chat AS (
    SELECT 
        cb.id as chat_id,
        COALESCE(
            ARRAY_AGG((p.id, p.name, p.icon, p.color)::types.q_get_simulation_attempt_v4_persona ORDER BY p.name)
            FILTER (WHERE p.id IS NOT NULL),
            '{}'::types.q_get_simulation_attempt_v4_persona[]
        ) as personas
    FROM chats_base cb
    LEFT JOIN scenario_personas sp ON sp.scenario_id = cb.scenario_id AND sp.active = true
    LEFT JOIN personas p ON p.id = sp.persona_id AND p.active = true
    GROUP BY cb.id
),
hints_data AS (
    SELECT 
        c.id AS chat_id,
        COALESCE(
            ARRAY_AGG(
                (m.id,
                 COALESCE(
                     (SELECT ARRAY_AGG(
                         (mh.message_id, h.hint, mh.idx, mh.created_at)::types.q_get_simulation_attempt_v4_hint
                         ORDER BY mh.idx
                     )
                     FROM message_hints mh
                     JOIN hints h ON h.id = mh.hint_id
                     WHERE mh.message_id = m.id),
                     '{}'::types.q_get_simulation_attempt_v4_hint[]
                 )
                )::types.q_get_simulation_attempt_v4_hints_by_message
            ) FILTER (WHERE m.role = 'assistant'::message_role),
            '{}'::types.q_get_simulation_attempt_v4_hints_by_message[]
        ) as hints
    FROM params x
    CROSS JOIN attempt_base ab
    JOIN chats c ON EXISTS (
        SELECT 1 FROM chat_groups cg
        JOIN groups g ON g.id = cg.group_id
        JOIN group_runs gr ON gr.group_id = g.id
        JOIN runs r ON r.id = gr.run_id
        JOIN message_runs mr ON mr.run_id = r.id
        WHERE cg.chat_id = c.id
    )
    JOIN chat_groups cg ON cg.chat_id = c.id
    JOIN groups g ON g.id = cg.group_id
    JOIN group_runs gr ON gr.group_id = g.id
    JOIN runs r ON r.id = gr.run_id
    JOIN message_runs mr ON mr.run_id = r.id
    JOIN messages m ON m.id = mr.message_id
    CROSS JOIN chat_ids_list cil
    WHERE c.id = ANY(cil.chat_ids)
      AND m.role IN ('user'::message_role, 'assistant'::message_role)
      AND ab.sim_practice_simulation = true
    GROUP BY c.id
),
feedbacks_grouped AS (
    SELECT 
        scf.grade_id as grade_id,
        COALESCE(
            ARRAY_AGG(
                (scf.id, scf.created_at, scf.standard_id, scf.grade_id, scf.total::float, scf.feedback)::types.q_get_simulation_attempt_v4_feedback
            ),
            '{}'::types.q_get_simulation_attempt_v4_feedback[]
        ) as feedbacks
    FROM feedbacks scf
    WHERE scf.grade_id IN (
        SELECT (gd.grade).id FROM grades_data gd
    )
    GROUP BY scf.grade_id
),
rubric_standard_groups AS (
    SELECT 
        sg.id,
        sg.name,
        sg.short_name,
        sg.points,
        sg.pass_points,
        sg.description,
        rsg.rubric_id
    FROM attempt_base ab
    JOIN rubric_standard_groups rsg ON rsg.rubric_id = ab.sim_rubric_id AND rsg.active = true
    JOIN standard_groups sg ON sg.id = rsg.standard_group_id
    WHERE ab.sim_rubric_id IS NOT NULL
),
rubric_standards_grouped AS (
    SELECT 
        s.standard_group_id,
        array_agg(s.id::text) as standard_ids,
        ARRAY_AGG(
            (s.id, s.name, s.points, s.standard_group_id)::types.q_get_simulation_attempt_v4_standard
        ) as standards_list
    FROM standards s
    WHERE s.standard_group_id IN (SELECT id FROM rubric_standard_groups)
    GROUP BY s.standard_group_id
),
standards_mapping_merged AS (
    SELECT 
        ARRAY_AGG(
            (s.id, s.name, COALESCE(s.description, ''), s.points)::types.q_get_simulation_attempt_v4_standard_mapping
        ) as standards_mapping
    FROM standards s
    WHERE s.standard_group_id IN (SELECT id FROM rubric_standard_groups)
),
rubric_structure_complete AS (
    SELECT 
        CASE 
            WHEN EXISTS (SELECT 1 FROM rubric_standard_groups) THEN
                (COALESCE(
                    (SELECT ARRAY_AGG(
                        (rsg.id, rsgroup.standard_ids)::types.q_get_simulation_attempt_v4_standard_group_standards
                    )
                    FROM rubric_standard_groups rsg
                    LEFT JOIN rubric_standards_grouped rsgroup ON rsgroup.standard_group_id = rsg.id),
                    '{}'::types.q_get_simulation_attempt_v4_standard_group_standards[]
                ),
                COALESCE(
                    (SELECT ARRAY_AGG(
                        (rsg.id, rsg.name, COALESCE(rsg.description, ''), rsg.points, rsg.pass_points)::types.q_get_simulation_attempt_v4_standard_group_mapping
                    )
                    FROM rubric_standard_groups rsg),
                    '{}'::types.q_get_simulation_attempt_v4_standard_group_mapping[]
                ),
                COALESCE(smm.standards_mapping, '{}'::types.q_get_simulation_attempt_v4_standard_mapping[])
                )::types.q_get_simulation_attempt_v4_rubric_structure
            ELSE NULL
        END as rubric_structure
    FROM standards_mapping_merged smm
),
scenario_documents_data AS (
    SELECT COALESCE(
        ARRAY_AGG(DISTINCT
            (d.id, d.name, ''::text, d.updated_at,
             COALESCE(SUBSTRING(u.file_path FROM '\\.([^\\.]+)$'), ''),
             COALESCE(
                 (SELECT array_agg(DISTINCT st.parent_id::text)
                  FROM scenario_documents sd2
                  JOIN scenario_tree st ON st.child_id = sd2.scenario_id AND st.parent_id = st.child_id
                  WHERE sd2.document_id = d.id AND sd2.active = true),
                 ARRAY[]::text[]
             ),
             false,
             false,
             d.active,
             COALESCE(
                 (SELECT array_agg(dd.department_id::text ORDER BY dd.created_at)
                  FROM document_departments dd 
                  WHERE dd.document_id = d.id AND dd.active = true),
                 NULL::text[]
             ),
             u.file_path,
             u.mime_type,
             du.upload_id,
             COALESCE(
                 (SELECT array_agg(DISTINCT df.field_id::text)
                  FROM document_fields df
                  WHERE df.document_id = d.id AND df.active = true),
                 ARRAY[]::text[]
             )
            )::types.q_get_simulation_attempt_v4_scenario_document
        ),
        '{}'::types.q_get_simulation_attempt_v4_scenario_document[]
    ) as scenario_documents
    FROM documents d
    LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
    LEFT JOIN uploads u ON u.id = du.upload_id
    JOIN scenario_documents sd ON sd.document_id = d.id
    CROSS JOIN scenario_ids_list sil
    WHERE sd.scenario_id = ANY(sil.scenario_ids) AND d.active = true
),
skill_scores_per_chat AS (
    SELECT 
        gd.chat_id,
        rsg.id as group_id,
        rsg.name as group_name,
        rsg.short_name,
        AVG(fb.total) as avg_score,
        MAX(std.points) as max_points,
        string_agg(COALESCE(fb.feedback, ''), '; ') as feedbacks_text
    FROM grades_data gd
    LEFT JOIN feedbacks_grouped fg ON fg.grade_id = (gd.grade).id
    CROSS JOIN rubric_standard_groups rsg
    JOIN rubric_standards_grouped rsgroup ON rsgroup.standard_group_id = rsg.id
    CROSS JOIN LATERAL unnest(rsgroup.standards_list) std
    CROSS JOIN LATERAL unnest(COALESCE(fg.feedbacks, '{}'::types.q_get_simulation_attempt_v4_feedback[])) fb
    WHERE fb.standard_id = std.id
    GROUP BY gd.chat_id, rsg.id, rsg.name, rsg.short_name
),
dynamic_rubric_per_chat AS (
    SELECT 
        gd.chat_id,
        CASE 
            WHEN gd.grade IS NOT NULL AND EXISTS (SELECT 1 FROM rubric_standard_groups) THEN
                (gd.chat_id,
                 (gd.grade).score::float,
                 (gd.grade).passed,
                 (gd.grade).time_taken::float,
                 COALESCE(
                     (SELECT ARRAY_AGG(
                         (sspc.group_name, ROUND((sspc.avg_score / sspc.max_points) * 5)::float)::types.q_get_simulation_attempt_v4_skill_score
                     )
                     FROM skill_scores_per_chat sspc
                     WHERE sspc.chat_id = gd.chat_id),
                     '{}'::types.q_get_simulation_attempt_v4_skill_score[]
                 ),
                 COALESCE(
                     (SELECT ARRAY_AGG(
                         (sspc.short_name, sspc.feedbacks_text)::types.q_get_simulation_attempt_v4_skill_feedback
                     )
                     FROM skill_scores_per_chat sspc
                     WHERE sspc.chat_id = gd.chat_id),
                     '{}'::types.q_get_simulation_attempt_v4_skill_feedback[]
                 ),
                 COALESCE(
                     (SELECT r.points FROM rubrics r 
                      CROSS JOIN attempt_base ab 
                      WHERE r.id = ab.sim_rubric_id),
                     0
                 )::float
                )::types.q_get_simulation_attempt_v4_dynamic_rubric
            ELSE NULL
        END as dynamic_rubric
    FROM grades_data gd
),
max_scores_per_group_chat AS (
    SELECT 
        gd.chat_id,
        s.standard_group_id,
        MAX(fb.total) as max_score,
        rsg.pass_points
    FROM grades_data gd
    LEFT JOIN feedbacks_grouped fg ON fg.grade_id = (gd.grade).id
    CROSS JOIN LATERAL unnest(COALESCE(fg.feedbacks, '{}'::types.q_get_simulation_attempt_v4_feedback[])) fb
    JOIN standards s ON s.id = fb.standard_id
    JOIN rubric_standard_groups rsg ON rsg.id = s.standard_group_id
    GROUP BY gd.chat_id, s.standard_group_id, rsg.pass_points
),
grading_state_per_chat AS (
    SELECT 
        gd.chat_id,
        CASE 
            WHEN gd.grade IS NOT NULL AND EXISTS (SELECT 1 FROM rubric_standard_groups) THEN
                (                COALESCE(
                    (SELECT ARRAY_AGG(
                        (fb.standard_id, true)::types.q_get_simulation_attempt_v4_standard_achievement
                    )
                    FROM feedbacks_grouped fg2
                    CROSS JOIN LATERAL unnest(COALESCE(fg2.feedbacks, '{}'::types.q_get_simulation_attempt_v4_feedback[])) fb
                    WHERE fg2.grade_id = (gd.grade).id),
                    '{}'::types.q_get_simulation_attempt_v4_standard_achievement[]
                ),
                COALESCE(
                    (SELECT ARRAY_AGG(
                        (fb.standard_id, (fb.total >= mspgc.pass_points)::boolean)::types.q_get_simulation_attempt_v4_standard_pass
                    )
                    FROM feedbacks_grouped fg3
                    CROSS JOIN LATERAL unnest(COALESCE(fg3.feedbacks, '{}'::types.q_get_simulation_attempt_v4_feedback[])) fb
                    JOIN standards s ON s.id = fb.standard_id
                    LEFT JOIN max_scores_per_group_chat mspgc 
                        ON mspgc.chat_id = gd.chat_id 
                        AND mspgc.standard_group_id = s.standard_group_id
                    WHERE fg3.grade_id = (gd.grade).id),
                    '{}'::types.q_get_simulation_attempt_v4_standard_pass[]
                ),
                COALESCE((gd.grade).description, ''),
                COALESCE(
                    (SELECT ARRAY_AGG(
                        (fb.standard_id, fb.feedback)::types.q_get_simulation_attempt_v4_standard_feedback
                    )
                    FROM feedbacks_grouped fg4
                    CROSS JOIN LATERAL unnest(COALESCE(fg4.feedbacks, '{}'::types.q_get_simulation_attempt_v4_feedback[])) fb
                    WHERE fg4.grade_id = (gd.grade).id),
                    '{}'::types.q_get_simulation_attempt_v4_standard_feedback[]
                )
                )::types.q_get_simulation_attempt_v4_grading_state
            ELSE NULL
        END as grading_state
    FROM grades_data gd
),
chats_with_all_data AS (
    SELECT 
        cb.id as chat_id,
        COALESCE(
            (SELECT srm.root_scenario_id 
             FROM scenario_root_mapping srm 
             WHERE srm.child_scenario_id = cb.scenario_id),
            cb.scenario_id
        ) as parent_scenario_id,
        ((cb.id, cb.created_at, cb.updated_at, cb.title, cb.scenario_id,
          COALESCE(
              (SELECT srm.root_scenario_id 
               FROM scenario_root_mapping srm 
               WHERE srm.child_scenario_id = cb.scenario_id),
              cb.scenario_id
          ),
          cb.attempt_id, cb.completed,
          CASE 
              WHEN cb.completed AND gd.grade IS NOT NULL 
              THEN (gd.grade).created_at
              ELSE NULL 
          END,
          cb.trace_id, cb.document_ids)::types.q_get_simulation_attempt_v4_chat,
         sd.scenario_data,
         COALESCE(mg.messages, '{}'::types.q_get_simulation_attempt_v4_message[]),
         COALESCE(hd.hints, '{}'::types.q_get_simulation_attempt_v4_hints_by_message[]),
         gd.grade,
         COALESCE(gspc.grading_state, NULL::types.q_get_simulation_attempt_v4_grading_state),
         drpc.dynamic_rubric,
         COALESCE(
             (SELECT previous_chats 
              FROM previous_chats_for_scenarios pcf2 
              WHERE pcf2.scenario_id = COALESCE(
                  (SELECT srm.root_scenario_id 
                   FROM scenario_root_mapping srm 
                   WHERE srm.child_scenario_id = cb.scenario_id),
                  cb.scenario_id
              )),
             '{}'::types.q_get_simulation_attempt_v4_previous_chat[]
         ),
         COALESCE(ppc.personas, '{}'::types.q_get_simulation_attempt_v4_persona[]),
         'scenario'::text,
         NULL::types.q_get_simulation_attempt_v4_video,
         NULL::types.q_get_simulation_attempt_v4_quiz
        )::types.q_get_simulation_attempt_v4_chat_data as chat_data,
        cb.completed,
        cb.created_at,
        gd.grade
    FROM chats_base cb
    LEFT JOIN scenarios_data sd ON sd.id = cb.scenario_id
    LEFT JOIN messages_grouped mg ON mg.chat_id = cb.id
    LEFT JOIN hints_data hd ON hd.chat_id = cb.id
    LEFT JOIN grades_data gd ON gd.chat_id = cb.id
    LEFT JOIN grading_state_per_chat gspc ON gspc.chat_id = cb.id
    LEFT JOIN dynamic_rubric_per_chat drpc ON drpc.chat_id = cb.id
    LEFT JOIN personas_per_chat ppc ON ppc.chat_id = cb.id
),
chats_with_positions AS (
    SELECT 
        cwad.chat_id,
        cwad.chat_data,
        cwad.completed,
        cwad.created_at,
        cwad.grade,
        COALESCE(
            (SELECT ss.position
             FROM simulation_scenarios ss
             CROSS JOIN attempt_base ab
             WHERE ss.simulation_id = ab.simulation_id 
               AND ss.scenario_id = (cwad.chat_data).scenario.id
               AND ss.active = true
             LIMIT 1),
            (SELECT ROW_NUMBER() OVER (ORDER BY cwad.created_at) FROM chats_with_all_data LIMIT 1)
        ) as position,
        'scenario'::text as content_type
    FROM chats_with_all_data cwad
),
unified_content AS (
    SELECT 
        chat_id::text as content_id,
        chat_data,
        completed,
        created_at,
        grade,
        position,
        'scenario'::text as content_type
    FROM chats_with_positions
),
aggregated_results_data AS (
    SELECT 
        CASE 
            WHEN COUNT(*) FILTER (WHERE completed = true AND grade IS NOT NULL) > 0 THEN
                (COALESCE(SUM((grade).score::numeric) FILTER (WHERE completed = true AND grade IS NOT NULL), 0)::float,
                 COALESCE(
                     (SELECT r.points FROM rubrics r 
                      CROSS JOIN attempt_base ab 
                      WHERE r.id = ab.sim_rubric_id) * COUNT(*) FILTER (WHERE completed = true AND grade IS NOT NULL),
                     0
                 )::float,
                 CASE 
                     WHEN (SELECT r.points FROM rubrics r 
                           CROSS JOIN attempt_base ab 
                           WHERE r.id = ab.sim_rubric_id) > 0 
                        AND COUNT(*) FILTER (WHERE completed = true AND grade IS NOT NULL) > 0 THEN
                         ROUND(
                             (SUM((grade).score::numeric) FILTER (WHERE completed = true AND grade IS NOT NULL)::numeric / 
                              ((SELECT r.points FROM rubrics r 
                                CROSS JOIN attempt_base ab 
                                WHERE r.id = ab.sim_rubric_id) * COUNT(*) FILTER (WHERE completed = true AND grade IS NOT NULL))::numeric) * 100.0,
                             1
                         )::float
                     ELSE 0.0
                 END,
                 BOOL_AND((grade).passed) FILTER (WHERE completed = true AND grade IS NOT NULL),
                 COUNT(*) FILTER (WHERE completed = true AND grade IS NOT NULL)::int,
                 COUNT(*)::int
                )::types.q_get_simulation_attempt_v4_aggregated_results
            ELSE NULL
        END as aggregated_results
    FROM unified_content
    CROSS JOIN attempt_base ab
),
elapsed_time_calc AS (
    SELECT 
        COALESCE(
            SUM(
                CASE 
                    WHEN uc.completed AND uc.grade IS NOT NULL THEN
                        (uc.grade).time_taken::integer
                    WHEN uc.completed THEN
                        EXTRACT(EPOCH FROM (
                            (uc.grade).created_at - uc.created_at
                        ))::integer
                    ELSE
                        EXTRACT(EPOCH FROM (NOW() - uc.created_at))::integer
                END
            ),
            0
        ) as total_elapsed
    FROM unified_content uc
),
timer_data AS (
    SELECT 
        (etc.total_elapsed::int,
         CASE 
             WHEN ab.sim_time_limit IS NOT NULL THEN
                 (ab.sim_time_limit * 60)::int
             ELSE NULL
         END,
         CASE 
             WHEN ab.infinite_mode AND ab.sim_time_limit IS NOT NULL THEN
                 (GREATEST((ab.sim_time_limit * 60) - etc.total_elapsed, 0) <= 0)
             WHEN ab.sim_time_limit IS NOT NULL THEN
                 ((ab.sim_time_limit * 60) - etc.total_elapsed < 0)
             ELSE false
         END,
         CASE 
             WHEN ab.sim_time_limit IS NOT NULL THEN
                 CASE 
                     WHEN ab.infinite_mode THEN
                         CONCAT(
                             FLOOR(GREATEST((ab.sim_time_limit * 60) - etc.total_elapsed, 0) / 3600)::text, 'h ',
                             FLOOR((GREATEST((ab.sim_time_limit * 60) - etc.total_elapsed, 0) % 3600) / 60)::text, 'm ',
                             (GREATEST((ab.sim_time_limit * 60) - etc.total_elapsed, 0) % 60)::text, 's'
                         )
                     ELSE
                         CONCAT(
                             FLOOR(GREATEST((ab.sim_time_limit * 60) - etc.total_elapsed, 0) / 3600)::text, 'h ',
                             FLOOR((GREATEST((ab.sim_time_limit * 60) - etc.total_elapsed, 0) % 3600) / 60)::text, 'm ',
                             (GREATEST((ab.sim_time_limit * 60) - etc.total_elapsed, 0) % 60)::text, 's'
                         )
                 END
             ELSE ''
         END
        )::types.q_get_simulation_attempt_v4_timer as timer
    FROM attempt_base ab
    CROSS JOIN elapsed_time_calc etc
),
simulation_scenario_count AS (
    SELECT 
        COUNT(*)::integer as total_scenarios
    FROM params x
    JOIN attempt_base ab ON ab.id = x.attempt_id
    JOIN simulation_scenarios ss ON ss.simulation_id = ab.simulation_id AND ss.active = true
),
scenarios_with_completed_chats AS (
    SELECT DISTINCT ss.scenario_id as parent_scenario_id
    FROM params x
    JOIN attempt_base ab ON ab.id = x.attempt_id
    JOIN simulation_scenarios ss ON ss.simulation_id = ab.simulation_id AND ss.active = true
    JOIN attempt_chats ac ON ac.attempt_id = ab.id
    JOIN chats sc ON sc.id = ac.chat_id
    JOIN grades scg ON EXISTS (
        SELECT 1 FROM runs r_check
        JOIN group_runs gr_check ON gr_check.run_id = r_check.id
        JOIN groups g_check ON g_check.id = gr_check.group_id
        JOIN chat_groups cg_check ON cg_check.group_id = g_check.id
        JOIN chats c_check ON c_check.id = cg_check.chat_id
        WHERE r_check.id = scg.run_id AND c_check.id = sc.id
    )
    WHERE COALESCE(
            (SELECT srm.root_scenario_id 
             FROM scenario_root_mapping srm 
             WHERE srm.child_scenario_id = sc.scenario_id),
            sc.scenario_id
        ) = ss.scenario_id
       OR sc.scenario_id = ss.scenario_id
),
total_content_count AS (
    SELECT 
        (SELECT COUNT(*) FROM simulation_scenarios_list) as total_count
),
metadata_computed AS (
    SELECT 
        COALESCE(
            (SELECT row_num - 1
             FROM (
                 SELECT 
                     content_id,
                     completed,
                     ROW_NUMBER() OVER (ORDER BY position, created_at) as row_num
                 FROM unified_content
             ) ranked
             WHERE completed = false
             ORDER BY row_num
             LIMIT 1),
            0
        ) as current_chat_index,
        COALESCE((SELECT total_count FROM total_content_count), COUNT(*)::integer) as expected_chat_count,
        COUNT(*) = 1 as is_single_chat_attempt,
        CASE 
            WHEN (SELECT infinite_mode FROM attempt_base) THEN false
            WHEN (SELECT total_count FROM total_content_count) > 0 THEN
                COALESCE(
                    (SELECT row_num - 1
                     FROM (
                         SELECT 
                             content_id,
                             completed,
                             ROW_NUMBER() OVER (ORDER BY position, created_at) as row_num
                         FROM unified_content
                     ) ranked
                     WHERE completed = false
                     ORDER BY row_num
                     LIMIT 1),
                    0
                ) = (SELECT total_count FROM total_content_count) - 1
            ELSE
                COALESCE(
                    (SELECT row_num - 1
                     FROM (
                         SELECT 
                             content_id,
                             completed,
                             ROW_NUMBER() OVER (ORDER BY position, created_at) as row_num
                         FROM unified_content
                     ) ranked
                     WHERE completed = false
                     ORDER BY row_num
                     LIMIT 1),
                    0
                ) = COUNT(*) - 1
        END as is_last_attempt,
        COALESCE(BOOL_AND(completed), false) as show_results,
        CASE 
            WHEN (SELECT COUNT(*) FROM simulation_root_scenarios_list) = 0 THEN false
            ELSE COALESCE((
                SELECT 
                    (SELECT COUNT(DISTINCT srsl.root_scenario_id) FROM simulation_root_scenarios_list srsl
                     LEFT JOIN scenarios_with_completed_chats swcc ON swcc.parent_scenario_id = srsl.root_scenario_id
                     WHERE swcc.parent_scenario_id IS NULL)
            ) > 0, true)
        END as should_show_controls,
        COALESCE((
            SELECT 
                (SELECT COUNT(DISTINCT srsl.root_scenario_id) FROM simulation_root_scenarios_list srsl
                 LEFT JOIN scenarios_with_completed_chats swcc ON swcc.parent_scenario_id = srsl.root_scenario_id
                 WHERE swcc.parent_scenario_id IS NULL)
        ), 0)::integer as remaining_scenarios_count,
        COALESCE((
            SELECT 
                (SELECT COUNT(DISTINCT srsl.root_scenario_id) FROM simulation_root_scenarios_list srsl
                 LEFT JOIN scenarios_with_completed_chats swcc ON swcc.parent_scenario_id = srsl.root_scenario_id
                 WHERE swcc.parent_scenario_id IS NULL)
        ), 0) = 1 as is_last_remaining_scenario,
        NOT (SELECT sim_practice_simulation FROM attempt_base) as can_pick_multiple_alternatives
    FROM unified_content
),
available_continuation_options AS (
    WITH current_scenario_position AS (
        SELECT COALESCE(
            (SELECT ss.position
             FROM simulation_scenarios ss
             CROSS JOIN attempt_base ab
             JOIN unified_content uc ON uc.content_type = 'scenario'
             WHERE ss.simulation_id = ab.simulation_id
               AND ss.scenario_id = (uc.chat_data).scenario.id
               AND ss.active = true
               AND uc.completed = false
             ORDER BY uc.position, uc.created_at
             LIMIT 1),
            1
        ) as current_position
    ),
    valid_next_scenarios AS (
        SELECT 
            ssl.scenario_id,
            ssl.position,
            (asswpc.scenario_data).name as scenario_name,
            asswpc.previous_chats
        FROM simulation_scenarios_list ssl
        CROSS JOIN attempt_base ab
        CROSS JOIN current_scenario_position csp
        JOIN all_simulation_scenarios_with_previous_chats asswpc 
            ON asswpc.scenario_id = ssl.scenario_id
        WHERE ssl.position >= csp.current_position
          AND ab.sim_practice_simulation = false
          AND array_length(COALESCE(asswpc.previous_chats, '{}'::types.q_get_simulation_attempt_v4_previous_chat[]), 1) > 0
        ORDER BY ssl.position
    ),
    scenario_options_expanded AS (
        SELECT 
            vns.scenario_id,
            vns.position,
            vns.scenario_name,
            pc.chat_id as previous_chat_id,
            COALESCE((SELECT title FROM chats WHERE id = pc.chat_id), 'Previous attempt') as title,
            pc.score,
            pc.percentage,
            pc.time_taken
        FROM valid_next_scenarios vns
        CROSS JOIN LATERAL unnest(COALESCE(vns.previous_chats, '{}'::types.q_get_simulation_attempt_v4_previous_chat[])) pc
    )
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (soe.scenario_id, soe.position, soe.scenario_name, soe.previous_chat_id, soe.title, soe.score, soe.percentage, soe.time_taken)::types.q_get_simulation_attempt_v4_continuation_option
                ORDER BY soe.position, soe.score DESC NULLS LAST
            ),
            '{}'::types.q_get_simulation_attempt_v4_continuation_option[]
        ) as next_sequential_options,
        CASE WHEN COUNT(*) > 0 THEN true ELSE false END as has_options
    FROM scenario_options_expanded soe
)
SELECT 
    aec.attempt_exists,
    ap.actor_name,
    COALESCE(rc.access_denied, false) as access_denied,
    (ab.id, ab.created_at, ab.simulation_id, ab.infinite_mode, ab.archived, cap.profile_id)::types.q_get_simulation_attempt_v4_attempt as attempt,
    (ab.sim_id, ab.sim_title, ab.sim_description, ab.sim_department_id, ab.sim_active, false, ab.sim_practice_simulation, 
     sf.hints_enabled, sf.objectives_enabled, false, false, sf.image_input_enabled, sf.copy_paste_allowed, 
     ab.sim_time_limit, ab.sim_rubric_id, ab.sim_created_at, ab.sim_updated_at)::types.q_get_simulation_attempt_v4_simulation as simulation,
    COALESCE(apd.attempt_profiles, '{}'::types.q_get_simulation_attempt_v4_attempt_profile[]) as attempt_profiles,
    COALESCE(
        (SELECT ARRAY_AGG(uc.chat_data ORDER BY uc.position, uc.created_at)
         FROM unified_content uc),
        '{}'::types.q_get_simulation_attempt_v4_chat_data[]
    ) as chats,
    COALESCE(sdd.scenario_documents, '{}'::types.q_get_simulation_attempt_v4_scenario_document[]) as scenario_documents,
    ard.aggregated_results,
    td.timer,
    md.current_chat_index,
    md.expected_chat_count,
    md.is_single_chat_attempt,
    md.is_last_attempt,
    md.show_results,
    md.should_show_controls,
    md.remaining_scenarios_count,
    md.is_last_remaining_scenario,
    md.can_pick_multiple_alternatives,
    NOT (COALESCE((td.timer).exceeded, false) OR md.show_results) as is_active,
    rsc.rubric_structure,
    COALESCE(
        (SELECT ARRAY_AGG(
            ((asswpc.scenario_data).id, (asswpc.scenario_data).name, (asswpc.scenario_data).problem_statement,
             (asswpc.scenario_data).department_id, (asswpc.scenario_data).active, (asswpc.scenario_data).persona_id,
             (asswpc.scenario_data).persona_name, (asswpc.scenario_data).persona_icon, (asswpc.scenario_data).persona_color,
             (asswpc.scenario_data).created_at, (asswpc.scenario_data).updated_at, (asswpc.scenario_data).generated,
             (asswpc.scenario_data).default_scenario, (asswpc.scenario_data).copy_paste_allowed,
             (asswpc.scenario_data).text_enabled, (asswpc.scenario_data).audio_enabled,
             (asswpc.scenario_data).show_problem_statement, (asswpc.scenario_data).show_objectives,
             (asswpc.scenario_data).show_images, (asswpc.scenario_data).background_image,
             (asswpc.scenario_data).objectives, asswpc.previous_chats)::types.q_get_simulation_attempt_v4_all_simulation_scenario
            ORDER BY asswpc.position
        )
        FROM all_simulation_scenarios_with_previous_chats asswpc),
        '{}'::types.q_get_simulation_attempt_v4_all_simulation_scenario[]
    ) as all_simulation_scenarios,
    COALESCE(
        (SELECT (aco.next_sequential_options, aco.has_options)::types.q_get_simulation_attempt_v4_available_continuation_options
         FROM available_continuation_options aco),
        (ARRAY[]::types.q_get_simulation_attempt_v4_continuation_option[], false)::types.q_get_simulation_attempt_v4_available_continuation_options
    ) as available_continuation_options
FROM attempt_exists_check aec
CROSS JOIN attempt_base ab 
CROSS JOIN attempt_profiles_data apd
CROSS JOIN actor_profile ap
CROSS JOIN current_attempt_profile cap
CROSS JOIN simulation_flags sf
CROSS JOIN scenario_documents_data sdd
CROSS JOIN aggregated_results_data ard
CROSS JOIN timer_data td
CROSS JOIN metadata_computed md
LEFT JOIN rubric_structure_complete rsc ON true
LEFT JOIN role_check rc ON true
$$;