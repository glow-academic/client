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
CREATE TYPE types.q_get_simulation_attempt_v4_replacements_entry AS (
    section text,
    replace text
);

CREATE TYPE types.q_get_simulation_attempt_v4_highlights_entry AS (
    section text
);

CREATE TYPE types.q_get_simulation_attempt_v4_message_feedback AS (
    id uuid,
    name text,
    description text,
    replaces types.q_get_simulation_attempt_v4_replacements_entry[],
    highlights types.q_get_simulation_attempt_v4_highlights_entry[]
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
    passed boolean,
    score int,
    time_taken int,
    total_points int,
    pass_points int
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
    attempt_profile_type text,
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
    chats_entry types.q_get_simulation_attempt_v4_chat_data[],
    scenario_documents_junction types.q_get_simulation_attempt_v4_scenario_document[],
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
WITH
-- Unified attempts (general + practice)
all_attempts AS (
    SELECT id, created_at, updated_at, infinite_mode, archived, generated, mcp, active
    FROM view_simulation_attempts_entry
),
-- Unified chats (general + practice)
all_chats AS (
    SELECT id, attempt_id, created_at, updated_at, title, completed, generated, mcp, active
    FROM view_simulation_chats_entry
),
-- Unified attempt→simulation connections
all_attempt_simulations AS (
    SELECT attempt_id, simulations_id FROM simulation_attempts_simulations_connection
),
-- Unified attempt→profile connections
all_attempt_profiles AS (
    SELECT attempt_id, profiles_id FROM simulation_attempts_profiles_connection
),
-- Unified chat→scenario connections
all_chat_scenarios AS (
    SELECT chat_id, scenarios_id FROM simulation_chats_scenarios_connection
),
params AS (
    SELECT 
        attempt_id AS attempt_id,
        profile_id AS profile_id
),
attempt_exists_check AS (
    SELECT EXISTS(
        SELECT 1 FROM all_attempts WHERE id = (SELECT attempt_id FROM params)
    )::boolean as attempt_exists
),
actor_profile AS (
    SELECT
        p.id as profile_id,
        COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
attempt_base AS (
    SELECT
        sa.id,
        sa.created_at,
        ssj.simulation_id,
        sa.infinite_mode,
        sa.archived,
        s.id as sim_id,
        (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) as sim_title,
        (SELECT (SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1) as sim_description,
        (SELECT department_id FROM simulation_departments_junction sd WHERE sd.simulation_id = s.id AND sd.active = true ORDER BY sd.created_at LIMIT 1) as sim_department_id,
        EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = TRUE) as sim_active,
        EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = s.id AND f.name = 'practice' AND sf.value = TRUE) as sim_practice_simulation,
        COALESCE(
            (SELECT SUM(stlr.time_limit_seconds)::int
             FROM simulation_scenario_time_limits_junction sstl
             JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id
             JOIN simulation_scenarios_junction ss ON ss.simulation_id = sstl.simulation_id AND ss.scenario_id = stlr.scenario_id
             WHERE sstl.simulation_id = s.id
               AND sstl.active = true
               AND stlr.active = true
               AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id
                   AND sfr.scenario_id = ss.scenario_id
                   AND f.name = 'simulation_active'
                   AND ssf.value = true)),
            0
        )::int as sim_time_limit,
        (SELECT srr.rubric_id FROM simulation_scenarios_junction ss
         JOIN simulation_scenario_rubrics_junction ssr ON ssr.simulation_id = ss.simulation_id
         JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubric_id AND srr.scenario_id = ss.scenario_id
         WHERE ss.simulation_id = s.id
           AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id
               AND sfr.scenario_id = ss.scenario_id
               AND f.name = 'simulation_active'
               AND ssf.value = true)
         ORDER BY (SELECT spr.value FROM simulation_scenario_positions_junction ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1)
         LIMIT 1) as sim_rubric_id,
        s.created_at as sim_created_at,
        s.created_at as sim_updated_at
    FROM params x
    JOIN all_attempts sa ON sa.id = x.attempt_id
    JOIN all_attempt_simulations aas ON aas.attempt_id = sa.id
    JOIN simulation_simulations_junction ssj ON ssj.simulations_id = aas.simulations_id
    JOIN simulation_artifact s ON s.id = ssj.simulation_id
),
attempt_profiles_data AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (ppj.profile_id, sa.id, true)::types.q_get_simulation_attempt_v4_attempt_profile
        ),
        '{}'::types.q_get_simulation_attempt_v4_attempt_profile[]
    ) as attempt_profiles
    FROM params x
    JOIN all_attempts sa ON sa.id = x.attempt_id
    JOIN all_attempt_profiles aap ON aap.attempt_id = sa.id
    JOIN profile_profiles_junction ppj ON ppj.profiles_id = aap.profiles_id
),
current_attempt_profile AS (
    SELECT ppj.profile_id
    FROM params x
    JOIN all_attempts sa ON sa.id = x.attempt_id
    JOIN all_attempt_profiles aap ON aap.attempt_id = sa.id
    JOIN profile_profiles_junction ppj ON ppj.profiles_id = aap.profiles_id
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
        attempt_role::text as attempt_profile_type,
        current_role::text as current_user_role
    FROM params x
    CROSS JOIN current_attempt_profile cap
    CROSS JOIN LATERAL (
        SELECT (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = cap.profile_id LIMIT 1)::text as attempt_role,
            CASE 
                WHEN (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = cap.profile_id LIMIT 1)::text = 'superadmin' THEN 5
                WHEN (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = cap.profile_id LIMIT 1)::text = 'admin' THEN 4
                WHEN (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = cap.profile_id LIMIT 1)::text = 'instructional' THEN 3
                WHEN (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = cap.profile_id LIMIT 1)::text = 'member' THEN 2
                ELSE 1
            END as attempt_role_level
    ) attempt_profile_type_info
    CROSS JOIN LATERAL (
        SELECT (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = x.profile_id LIMIT 1)::text as current_role,
            CASE 
                WHEN (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = x.profile_id LIMIT 1)::text = 'superadmin' THEN 5
                WHEN (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = x.profile_id LIMIT 1)::text = 'admin' THEN 4
                WHEN (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = x.profile_id LIMIT 1)::text = 'instructional' THEN 3
                WHEN (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = x.profile_id LIMIT 1)::text = 'member' THEN 2
                ELSE 1
            END as current_role_level
    ) current_user_role_info
),
simulation_scenarios_list AS (
    SELECT ss.scenario_id, (SELECT spr.value FROM simulation_scenario_positions_junction ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1) as position
    FROM params x
    JOIN attempt_base ab ON ab.id = x.attempt_id
    JOIN simulation_scenarios_junction ss ON ss.simulation_id = ab.simulation_id 
      AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id
          AND sfr.scenario_id = ss.scenario_id
          AND f.name = 'scenario_active' 
          AND ssf.value = true)
    ORDER BY (SELECT spr.value FROM simulation_scenario_positions_junction ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1)
),
chat_ids_list AS (
    SELECT array_agg(id) as chat_ids
    FROM (
        SELECT sc.id
        FROM params x
        JOIN all_chats sc ON sc.attempt_id = x.attempt_id
        ORDER BY sc.created_at
    ) chats_base
),
scenario_ids_list AS (
    SELECT array_agg(DISTINCT ssj_sc.scenario_id) as scenario_ids
    FROM (
        SELECT ssj_sc.scenario_id
        FROM params x
        JOIN all_chats sc ON sc.attempt_id = x.attempt_id
        JOIN all_chat_scenarios acs ON acs.chat_id = sc.id
        JOIN scenario_scenarios_junction ssj_sc ON ssj_sc.scenarios_id = acs.scenarios_id
    ) ssj_sc
),
chats_base AS (
    SELECT
        sc.id,
        sc.created_at,
        sc.updated_at,
        sc.title,
        ssj_sc.scenario_id,
        sc.attempt_id,
        sc.completed,
        g.trace_id,
        COALESCE(
            (SELECT array_agg(DISTINCT sd.document_id::text)
             FROM scenario_documents_junction sd
             WHERE sd.scenario_id = ssj_sc.scenario_id AND sd.active = true),
            ARRAY[]::text[]
        ) as document_ids
    FROM params x
    JOIN all_chats sc ON sc.attempt_id = x.attempt_id
    JOIN all_chat_scenarios acs ON acs.chat_id = sc.id
    JOIN scenario_scenarios_junction ssj_sc ON ssj_sc.scenarios_id = acs.scenarios_id
    LEFT JOIN LATERAL (
        SELECT r.group_id FROM view_simulation_messages_entry m_g JOIN view_runs_entry r ON r.id = m_g.run_id WHERE m_g.chat_id = sc.id LIMIT 1
    ) sc_group ON true
    LEFT JOIN view_groups_entry g ON g.id = sc_group.group_id
    ORDER BY sc.created_at
),
-- Get scenario videos and questions (videos now accessed through scenarios)
scenario_videos_with_questions AS (
    SELECT 
        sv.scenario_id,
        v.id as video_id,
        v.name as video_title,
        v.length_seconds,
        v.upload_id,
        COALESCE(
            (SELECT ARRAY_AGG(
                (q.id, q.question_text, 'choice'::text, q.allow_multiple,
                 ARRAY[q.time]::int[],
                 COALESCE(
                     (SELECT ARRAY_AGG(
                         (o.id, o.option_text, 'discrete'::text, o.is_correct)::types.q_get_simulation_attempt_v4_option
                         ORDER BY o.id
                     )
                     FROM scenario_options_junction so
                     JOIN options_resource o ON o.id = so.option_id AND o.active = true
                     WHERE so.scenario_id = sv.scenario_id AND so.active = true),
                     '{}'::types.q_get_simulation_attempt_v4_option[]
                 )
                )::types.q_get_simulation_attempt_v4_question
                ORDER BY sq.created_at
            )
            FROM scenario_questions_junction sq
            JOIN questions_resource q ON q.id = sq.question_id
            WHERE sq.scenario_id = sv.scenario_id AND sq.active = true AND q.active = true),
            '{}'::types.q_get_simulation_attempt_v4_question[]
        ) as questions
    FROM scenario_videos_junction sv
    JOIN videos_resource v ON v.id = sv.video_id
    WHERE sv.active = true AND v.active = true
),
-- Note: Quizzes are deprecated - questions are now handled directly through scenarios
-- Quiz data has been removed - responses are now linked to view_chats_entry via chat_responses junction table
simulation_root_scenarios_list AS (
    SELECT DISTINCT
        ss.scenario_id as root_scenario_id,
        (SELECT spr.value FROM simulation_scenario_positions_junction ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1) as position
    FROM params x
    JOIN attempt_base ab ON ab.id = x.attempt_id
    JOIN simulation_scenarios_junction ss ON ss.simulation_id = ab.simulation_id 
      AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id
          AND sfr.scenario_id = ss.scenario_id
          AND f.name = 'scenario_active' 
          AND ssf.value = true)
    ORDER BY (SELECT spr.value FROM simulation_scenario_positions_junction ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1)
),
-- Recursively map all child scenarios to their root parent scenarios
scenario_root_mapping AS (
    WITH RECURSIVE scenario_ancestors AS (
        SELECT DISTINCT
            ssj_scj2.scenario_id as child_scenario_id,
            ssj_scj2.scenario_id as ancestor_id,
            0 as depth
        FROM params x
        JOIN all_chats sc ON sc.attempt_id = x.attempt_id
        JOIN all_chat_scenarios acs2 ON acs2.chat_id = sc.id
        JOIN scenario_scenarios_junction ssj_scj2 ON ssj_scj2.scenarios_id = acs2.scenarios_id

        UNION ALL

        SELECT
            sa.child_scenario_id,
            COALESCE(
                (SELECT st.parent_id
                 FROM scenario_tree_junction st
                 WHERE st.child_id = sa.ancestor_id
                   AND st.parent_id != st.child_id
                 LIMIT 1),
                sa.ancestor_id
            ) as ancestor_id,
            sa.depth + 1 as depth
        FROM scenario_ancestors sa
        WHERE sa.depth < 100
          AND EXISTS (
              SELECT 1 FROM scenario_tree_junction st
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
            ssj_scj3.scenario_id as child_scenario_id,
            ssj_scj3.scenario_id as ancestor_id,
            0 as depth
        FROM params x
        CROSS JOIN current_attempt_profile cap
        JOIN all_chats sc ON EXISTS (
            SELECT 1 FROM all_attempts sa2
            JOIN all_attempt_profiles aap3 ON aap3.attempt_id = sa2.id
            JOIN profile_profiles_junction ppj3 ON ppj3.profiles_id = aap3.profiles_id
            WHERE sa2.id = sc.attempt_id
              AND ppj3.profile_id = cap.profile_id
              AND sc.completed = true
              AND EXISTS (
                  SELECT 1 FROM view_grades_entry scg
                  WHERE scg.chat_id = sc.id
              )
              AND sc.attempt_id != x.attempt_id
        )
        JOIN all_chat_scenarios acs3 ON acs3.chat_id = sc.id
        JOIN scenario_scenarios_junction ssj_scj3 ON ssj_scj3.scenarios_id = acs3.scenarios_id

        UNION ALL

        SELECT
            sa.child_scenario_id,
            COALESCE(
                (SELECT st.parent_id
                 FROM scenario_tree_junction st
                 WHERE st.child_id = sa.ancestor_id
                   AND st.parent_id != st.child_id
                 LIMIT 1),
                sa.ancestor_id
            ) as ancestor_id,
            sa.depth + 1 as depth
        FROM scenario_ancestors sa
        WHERE sa.depth < 100
          AND EXISTS (
              SELECT 1 FROM scenario_tree_junction st
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
-- Find previous completed all_chats from other attempts by same profile
previous_chats_with_grades AS (
    SELECT DISTINCT ON (sc.id)
        sc.id as chat_id,
        ssj_scj4.scenario_id as child_scenario_id,
        COALESCE(
            (SELECT pcsrm.root_scenario_id
             FROM previous_chat_scenario_root_mapping pcsrm
             WHERE pcsrm.child_scenario_id = ssj_scj4.scenario_id),
            ssj_scj4.scenario_id
        ) as parent_scenario_id,
        sc.attempt_id,
        ssj2.simulation_id,
        sc.title,
        sc.created_at,
        scg.score,
        scg.passed,
        COALESCE(scg.time_taken, 0) as time_taken
    FROM params x
    CROSS JOIN current_attempt_profile cap
    CROSS JOIN simulation_scenarios_list ssl
    CROSS JOIN attempt_base ab
    JOIN all_attempt_profiles aap2 ON aap2.profiles_id = (SELECT profiles_id FROM profile_profiles_junction WHERE profile_id = cap.profile_id LIMIT 1)
    JOIN all_attempts sa2 ON sa2.id = aap2.attempt_id
    JOIN all_attempt_simulations aas2 ON aas2.attempt_id = sa2.id
    JOIN simulation_simulations_junction ssj2 ON ssj2.simulations_id = aas2.simulations_id
    JOIN all_chats sc ON sc.attempt_id = sa2.id
      AND sc.completed = true
      AND EXISTS (
          SELECT 1 FROM view_grades_entry scg
          WHERE scg.chat_id = sc.id
      )
      AND sc.attempt_id != x.attempt_id
      AND ab.sim_practice_simulation = false
    JOIN all_chat_scenarios acs4 ON acs4.chat_id = sc.id
    JOIN scenario_scenarios_junction ssj_scj4 ON ssj_scj4.scenarios_id = acs4.scenarios_id
    LEFT JOIN view_grades_entry scg ON scg.chat_id = sc.id
    WHERE COALESCE(
            (SELECT pcsrm.root_scenario_id
             FROM previous_chat_scenario_root_mapping pcsrm
             WHERE pcsrm.child_scenario_id = ssj_scj4.scenario_id),
            ssj_scj4.scenario_id
        ) = ssl.scenario_id
    ORDER BY sc.id, scg.created_at DESC NULLS LAST
),
previous_attempt_time_aggregation AS (
    SELECT
        sc.attempt_id,
        COALESCE(SUM(COALESCE(scg.time_taken, 0)), 0)::integer as total_time_taken
    FROM previous_chats_with_grades pwg
    JOIN all_chats sc ON sc.attempt_id = pwg.attempt_id
    JOIN view_grades_entry scg ON scg.chat_id = sc.id
    WHERE sc.completed = true
    GROUP BY sc.attempt_id
),
previous_attempt_rubric_points AS (
    SELECT DISTINCT ON (ssj_parp.simulation_id)
        ssj_parp.simulation_id,
        COALESCE((SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = srr_rubric.rubric_id AND rp.type = 'total'::point_type LIMIT 1), 0)::integer as total_points
    FROM previous_chats_with_grades pwg
    JOIN all_attempts sa ON sa.id = pwg.attempt_id
    JOIN all_attempt_simulations aas_parp ON aas_parp.attempt_id = sa.id
    JOIN simulation_simulations_junction ssj_parp ON ssj_parp.simulations_id = aas_parp.simulations_id
    JOIN simulation_artifact s ON s.id = ssj_parp.simulation_id
    LEFT JOIN simulation_scenarios_junction ss_rubric ON ss_rubric.simulation_id = s.id
      AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss_rubric.simulation_id
          AND sfr.scenario_id = ss_rubric.scenario_id
          AND f.name = 'scenario_active'
          AND ssf.value = true)
    LEFT JOIN simulation_scenario_rubrics_junction ssr_rubric ON ssr_rubric.simulation_id = ss_rubric.simulation_id
    LEFT JOIN scenario_rubrics_resource srr_rubric ON srr_rubric.id = ssr_rubric.scenario_rubric_id AND srr_rubric.scenario_id = ss_rubric.scenario_id
    ORDER BY ssj_parp.simulation_id
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
                         TRUNC((pwg.score::numeric / parp.total_points::numeric) * 100.0, 2)::float
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
        i.upload_id as background_image_upload_id
    FROM params x
    JOIN attempt_base ab ON ab.id = x.attempt_id
    JOIN scenario_images_junction si ON EXISTS (SELECT 1 FROM simulation_scenarios_junction ss WHERE ss.simulation_id = ab.simulation_id
          AND ss.scenario_id = si.scenario_id
      AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id
          AND sfr.scenario_id = ss.scenario_id
              AND f.name = 'scenario_active'
              AND ssf.value = true)
    )
    JOIN images_resource i ON i.id = si.image_id AND i.active = true
    WHERE si.active = true
      AND i.upload_id IS NOT NULL
    ORDER BY si.scenario_id, si.created_at ASC
),
all_simulation_scenarios_with_previous_chats AS (
    SELECT 
        ssl.scenario_id,
        ssl.position,
        (s.id, (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1), COALESCE(ps.problem_statement, ''),
         COALESCE((SELECT department_id FROM scenario_departments_junction sd WHERE sd.scenario_id = s.id AND sd.active = true ORDER BY sd.created_at LIMIT 1), NULL::uuid),
         EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = TRUE),
         pp.persona_id,
         (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = pp.persona_id LIMIT 1),
         (SELECT i.value FROM persona_icons_junction pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = pp.persona_id LIMIT 1),
         (SELECT c.hex_code FROM persona_colors_junction pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = pp.persona_id LIMIT 1),
         s.created_at,
         s.created_at,
         false,
         false,
         COALESCE((SELECT ssf.value FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id
             AND sfr.scenario_id = ss.scenario_id
             AND f.name = 'copy_paste_allowed'), false),
         COALESCE((SELECT ssf.value FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id
             AND sfr.scenario_id = ss.scenario_id
             AND f.name = 'text_enabled'), true),
         COALESCE((SELECT ssf.value FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id
             AND sfr.scenario_id = ss.scenario_id
             AND f.name = 'audio_enabled'), false),
         COALESCE((SELECT ssf.value FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id
             AND sfr.scenario_id = ss.scenario_id
             AND f.name = 'show_problem_statement'), true),
         COALESCE((SELECT ssf.value FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id
             AND sfr.scenario_id = ss.scenario_id
             AND f.name = 'show_objectives'), true),
         COALESCE((SELECT ssf.value FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id
             AND sfr.scenario_id = ss.scenario_id
             AND f.name = 'show_images'), true),
         sbi.background_image_upload_id,
         COALESCE(
             (SELECT ARRAY_AGG(o.objective ORDER BY so.idx)
              FROM scenario_objectives_junction so
              JOIN objectives_resource o ON o.id = so.objective_id
              WHERE so.scenario_id = s.id),
             ARRAY[]::text[]
         )
        )::types.q_get_simulation_attempt_v4_scenario as scenario_data,
        COALESCE(pcf.previous_chats, '{}'::types.q_get_simulation_attempt_v4_previous_chat[]) as previous_chats
    FROM simulation_scenarios_list ssl
    LEFT JOIN simulation_scenarios_junction ss ON ss.scenario_id = ssl.scenario_id AND ss.simulation_id = (SELECT simulation_id FROM attempt_base)
    LEFT JOIN scenarios_resource s ON s.id = ssl.scenario_id
    LEFT JOIN scenario_problem_statements_junction sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements_resource ps ON ps.id = sps.problem_statement_id
    LEFT JOIN scenario_personas_junction sp ON sp.scenario_id = s.id AND sp.active = true
    LEFT JOIN personas_resource p ON p.id = sp.persona_id
    LEFT JOIN persona_personas_junction pp ON pp.personas_id = p.id
    LEFT JOIN scenario_background_images_for_simulation sbi ON sbi.scenario_id = s.id
    LEFT JOIN previous_chats_for_scenarios pcf ON pcf.scenario_id = ssl.scenario_id
    ORDER BY ssl.position
),
scenario_background_images_for_chats AS (
    SELECT DISTINCT ON (si.scenario_id)
        si.scenario_id,
        i.upload_id as background_image_upload_id
    FROM scenario_images_junction si
    JOIN images_resource i ON i.id = si.image_id AND i.active = true
    CROSS JOIN scenario_ids_list sil
    WHERE si.scenario_id = ANY(sil.scenario_ids)
      AND si.active = true
      AND i.upload_id IS NOT NULL
    ORDER BY si.scenario_id, si.created_at ASC
),
scenarios_data AS (
    SELECT
        s.id,
        (s.id, (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1), COALESCE(ps.problem_statement, ''),
         COALESCE((SELECT department_id FROM scenario_departments_junction sd WHERE sd.scenario_id = s.id AND sd.active = true ORDER BY sd.created_at LIMIT 1), NULL::uuid),
         EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = TRUE),
         pp.persona_id,
         (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = pp.persona_id LIMIT 1),
         (SELECT i.value FROM persona_icons_junction pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = pp.persona_id LIMIT 1),
         (SELECT c.hex_code FROM persona_colors_junction pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = pp.persona_id LIMIT 1),
         s.created_at,
         s.created_at,
         false,
         false,
         COALESCE((SELECT ssf.value FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id
             AND sfr.scenario_id = ss.scenario_id
             AND f.name = 'copy_paste_allowed'), false),
         COALESCE((SELECT ssf.value FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id
             AND sfr.scenario_id = ss.scenario_id
             AND f.name = 'text_enabled'), true),
         COALESCE((SELECT ssf.value FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id
             AND sfr.scenario_id = ss.scenario_id
             AND f.name = 'audio_enabled'), false),
         COALESCE((SELECT ssf.value FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id
             AND sfr.scenario_id = ss.scenario_id
             AND f.name = 'show_problem_statement'), true),
         COALESCE((SELECT ssf.value FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id
             AND sfr.scenario_id = ss.scenario_id
             AND f.name = 'show_objectives'), true),
         COALESCE((SELECT ssf.value FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id
             AND sfr.scenario_id = ss.scenario_id
             AND f.name = 'show_images'), true),
         sbi.background_image_upload_id,
         COALESCE(
             (SELECT ARRAY_AGG(o.objective ORDER BY so.idx)
              FROM scenario_objectives_junction so
              JOIN objectives_resource o ON o.id = so.objective_id
              WHERE so.scenario_id = s.id),
             ARRAY[]::text[]
         )
        )::types.q_get_simulation_attempt_v4_scenario as scenario_data,
        COALESCE((SELECT ssf.value FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.name = 'hints_enabled'), false) as hints_enabled,
        COALESCE(EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'objectives_enabled' AND sf.value = true), true) as objectives_enabled,
        COALESCE(EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'images_enabled' AND sf.value = true), false) as image_input_enabled,
        COALESCE((SELECT ssf.value FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id
            AND sfr.scenario_id = ss.scenario_id
            AND f.name = 'copy_paste_allowed'), false) as copy_paste_allowed
    FROM scenarios_resource sr
    JOIN scenario_scenarios_junction ssj_sr ON ssj_sr.scenarios_id = sr.id
    JOIN scenario_artifact s ON s.id = ssj_sr.scenario_id
    CROSS JOIN scenario_ids_list sil
    CROSS JOIN attempt_base ab
    LEFT JOIN simulation_scenarios_junction ss ON ss.scenario_id = sr.id AND ss.simulation_id = ab.simulation_id
    LEFT JOIN scenario_problem_statements_junction sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements_resource ps ON ps.id = sps.problem_statement_id
    LEFT JOIN scenario_personas_junction sp ON sp.scenario_id = s.id AND sp.active = true
    LEFT JOIN personas_resource p ON p.id = sp.persona_id
    LEFT JOIN persona_personas_junction pp ON pp.personas_id = p.id
    LEFT JOIN scenario_background_images_for_chats sbi ON sbi.scenario_id = s.id
    WHERE s.id = ANY(sil.scenario_ids)
),
simulation_flags_junction AS (
    SELECT 
        COALESCE((SELECT ssf.value FROM chats_base cb CROSS JOIN attempt_base ab JOIN simulation_scenario_flags_junction ssf ON ssf.simulation_id = ab.simulation_id JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id AND sfr.scenario_id = cb.scenario_id JOIN flags_resource f ON sfr.flag_id = f.id AND f.name = 'hints_enabled' WHERE cb.attempt_id = ab.id ORDER BY cb.created_at LIMIT 1), false) as hints_enabled,
        COALESCE((SELECT EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'objectives_enabled' AND sf.value = true) FROM simulation_scenarios_junction ss JOIN chats_base cb ON ss.scenario_id = cb.scenario_id JOIN scenarios_resource s ON s.id = ss.scenario_id CROSS JOIN attempt_base ab WHERE ss.simulation_id = ab.simulation_id ORDER BY cb.created_at LIMIT 1), true) as objectives_enabled,
        COALESCE((SELECT EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'images_enabled' AND sf.value = true) FROM simulation_scenarios_junction ss JOIN chats_base cb ON ss.scenario_id = cb.scenario_id JOIN scenarios_resource s ON s.id = ss.scenario_id CROSS JOIN attempt_base ab WHERE ss.simulation_id = ab.simulation_id ORDER BY cb.created_at LIMIT 1), false) as image_input_enabled,
        COALESCE((SELECT ssf.value FROM simulation_scenarios_junction ss 
          JOIN chats_base cb ON ss.scenario_id = cb.scenario_id 
          CROSS JOIN attempt_base ab 
          LEFT JOIN simulation_scenario_flags_junction ssf ON ssf.simulation_id = ss.simulation_id
          LEFT JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id AND sfr.scenario_id = ss.scenario_id 
          LEFT JOIN flags_resource f ON ssf.scenario_flag_id = f.id AND f.name = 'copy_paste_allowed'
          WHERE ss.simulation_id = ab.simulation_id 
          ORDER BY cb.created_at LIMIT 1), false) as copy_paste_allowed
),
-- Tree traversal for view_messages_entry: get all view_messages_entry following conversation flow
messages_with_tree AS (
    WITH RECURSIVE message_path AS (
        SELECT
            m.id,
            c.id AS chat_id,
            CASE WHEN m.role = 'user'::message_type THEN 'query' ELSE 'response' END as type,
            ce.content,
            m.created_at,
            m.completed,
            m.updated_at,
            NULL::uuid AS persona_id,
            0 as depth,
            m.id as path_root_id
        FROM all_chats c
        JOIN view_simulation_messages_entry m ON m.chat_id = c.id
        JOIN view_runs_entry r ON r.id = m.run_id
        LEFT JOIN LATERAL (
            SELECT content
            FROM simulation_contents_entry ce
            WHERE ce.message_id = m.id
              AND ce.active = true
            ORDER BY ce.created_at
            LIMIT 1
        ) ce ON TRUE
        CROSS JOIN chat_ids_list cil
        WHERE c.id = ANY(cil.chat_ids)
          AND m.role IN ('user'::message_type, 'assistant'::message_type)
          AND NOT EXISTS (
              SELECT 1 FROM view_message_tree_entry mt
              WHERE mt.parent_id = m.id AND mt.active = true
          )

        UNION ALL

        SELECT
            m.id,
            mp.chat_id,
            CASE WHEN m.role = 'user'::message_type THEN 'query' ELSE 'response' END as type,
            ce.content,
            m.created_at,
            m.completed,
            m.updated_at,
            NULL::uuid AS persona_id,
            mp.depth + 1 as depth,
            mp.path_root_id
        FROM view_simulation_messages_entry m
        LEFT JOIN LATERAL (
            SELECT content
            FROM simulation_contents_entry ce
            WHERE ce.message_id = m.id
              AND ce.active = true
            ORDER BY ce.created_at
            LIMIT 1
        ) ce ON TRUE
        JOIN view_message_tree_entry mt ON mt.parent_id = m.id AND mt.active = true
        JOIN message_path mp ON mp.id = mt.child_id
        JOIN view_runs_entry r ON r.id = m.run_id
        JOIN all_chats c ON c.id = m.chat_id
        CROSS JOIN chat_ids_list cil
        WHERE mp.depth < 1000
          AND m.role IN ('user'::message_type, 'assistant'::message_type)
          AND c.id = mp.chat_id
          AND c.id = ANY(cil.chat_ids)
    ),
    messages_without_parents AS (
        SELECT
            m.id,
            c.id AS chat_id,
            CASE WHEN m.role = 'user'::message_type THEN 'query' ELSE 'response' END as type,
            ce.content,
            m.created_at,
            m.completed,
            m.updated_at,
            NULL::uuid AS persona_id,
            -1 as depth,
            m.id as path_root_id
        FROM all_chats c
        JOIN view_simulation_messages_entry m ON m.chat_id = c.id
        JOIN view_runs_entry r ON r.id = m.run_id
        LEFT JOIN LATERAL (
            SELECT content
            FROM simulation_contents_entry ce
            WHERE ce.message_id = m.id
              AND ce.active = true
            ORDER BY ce.created_at
            LIMIT 1
        ) ce ON TRUE
        CROSS JOIN chat_ids_list cil
        WHERE c.id = ANY(cil.chat_ids)
          AND m.role IN ('user'::message_type, 'assistant'::message_type)
          AND NOT EXISTS (
              SELECT 1 FROM view_message_tree_entry mt
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
        (scg.id, scg.created_at, c.id, COALESCE(srr.rubric_id, srr_fallback.rubric_id, sfsr.rubric_id), scg.passed, scg.score, COALESCE(scg.time_taken, 0), scg.total_points, scg.pass_points)::types.q_get_simulation_attempt_v4_grade as grade
    FROM params x
    CROSS JOIN chat_ids_list cil
    JOIN all_chats c ON c.id = ANY(cil.chat_ids)
    LEFT JOIN all_chat_scenarios acs_grade ON acs_grade.chat_id = c.id
    LEFT JOIN scenario_scenarios_junction ssj_grade ON ssj_grade.scenarios_id = acs_grade.scenarios_id
    JOIN view_grades_entry scg ON scg.chat_id = c.id
    LEFT JOIN scenario_rubrics_resource srr ON srr.scenario_id = ssj_grade.scenario_id
    LEFT JOIN all_attempts sa_sim ON sa_sim.id = c.attempt_id
    LEFT JOIN all_attempt_simulations aas_sim ON aas_sim.attempt_id = sa_sim.id
    LEFT JOIN simulation_simulations_junction ssj_sim ON ssj_sim.simulations_id = aas_sim.simulations_id
    LEFT JOIN simulation_scenario_rubrics_junction ssr_fallback ON ssr_fallback.simulation_id = ssj_sim.simulation_id
    LEFT JOIN scenario_rubrics_resource srr_fallback ON srr_fallback.id = ssr_fallback.scenario_rubric_id AND srr_fallback.scenario_id = ssj_grade.scenario_id AND srr.rubric_id IS NULL
    LEFT JOIN LATERAL (
        SELECT srr_fallback2.rubric_id
        FROM simulation_scenarios_junction ss_fallback
        JOIN simulation_scenario_rubrics_junction ssr_fallback2 ON ssr_fallback2.simulation_id = ss_fallback.simulation_id
        JOIN scenario_rubrics_resource srr_fallback2 ON srr_fallback2.id = ssr_fallback2.scenario_rubric_id AND srr_fallback2.scenario_id = ss_fallback.scenario_id
        WHERE ss_fallback.simulation_id = ssj_sim.simulation_id
          AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss_fallback.simulation_id AND sfr.scenario_id = ss_fallback.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)
        ORDER BY (SELECT spr.value FROM simulation_scenario_positions_junction ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss_fallback.simulation_id AND spr.scenario_id = ss_fallback.scenario_id LIMIT 1)
        LIMIT 1
    ) sfsr ON srr.rubric_id IS NULL AND srr_fallback.rubric_id IS NULL
    ORDER BY c.id, scg.created_at DESC
),
message_feedbacks_data AS (
    -- Strengths with highlights
    SELECT
        se.message_id,
        se.grade_id,
        (se.id, se.name, se.description,
         '{}'::types.q_get_simulation_attempt_v4_replacements_entry[],
         COALESCE(
             (SELECT ARRAY_AGG((mfh.section)::types.q_get_simulation_attempt_v4_highlights_entry ORDER BY mfh.idx)
                        FROM view_highlights_entry mfh
                        WHERE mfh.message_feedback_id = se.id),
             '{}'::types.q_get_simulation_attempt_v4_highlights_entry[]
         )
        )::types.q_get_simulation_attempt_v4_message_feedback as feedback_data
    FROM view_strengths_entry se
    WHERE se.grade_id IN (SELECT (gd.grade).id FROM grades_data gd)
    UNION ALL
    -- Improvements with replaces
    SELECT
        ie.message_id,
        ie.grade_id,
        (ie.id, ie.name, ie.description,
         COALESCE(
             (SELECT ARRAY_AGG((mfr.section, mfr.replace)::types.q_get_simulation_attempt_v4_replacements_entry ORDER BY mfr.idx)
                        FROM view_replacements_entry mfr
                        WHERE mfr.message_feedback_id = ie.id),
             '{}'::types.q_get_simulation_attempt_v4_replacements_entry[]
         ),
         '{}'::types.q_get_simulation_attempt_v4_highlights_entry[]
        )::types.q_get_simulation_attempt_v4_message_feedback as feedback_data
    FROM view_improvements_entry ie
    WHERE ie.grade_id IN (SELECT (gd.grade).id FROM grades_data gd)
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
            ARRAY_AGG((p.id, (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1), (SELECT i.value FROM persona_icons_junction pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1), (SELECT c.hex_code FROM persona_colors_junction pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1))::types.q_get_simulation_attempt_v4_persona ORDER BY (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1))
            FILTER (WHERE p.id IS NOT NULL),
            '{}'::types.q_get_simulation_attempt_v4_persona[]
        ) as personas
    FROM chats_base cb
    LEFT JOIN scenario_personas_junction sp ON sp.scenario_id = cb.scenario_id AND sp.active = true
    LEFT JOIN personas_resource p ON p.id = sp.persona_id AND EXISTS (SELECT 1 FROM persona_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.persona_id = p.id AND f.name = 'persona_active' AND pf.value = true)
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
                         (he.message_id, he.hint, he.idx, he.created_at)::types.q_get_simulation_attempt_v4_hint
                         ORDER BY he.idx
                     )
                     FROM view_hints_entry he
                     WHERE he.message_id = m.id),
                     '{}'::types.q_get_simulation_attempt_v4_hint[]
                 )
                )::types.q_get_simulation_attempt_v4_hints_by_message
            ) FILTER (WHERE m.role = 'assistant'::message_type),
            '{}'::types.q_get_simulation_attempt_v4_hints_by_message[]
        ) as hints
    FROM params x
    CROSS JOIN attempt_base ab
    JOIN all_chats c ON true
    JOIN view_simulation_messages_entry m ON m.chat_id = c.id
    JOIN view_runs_entry r ON r.id = m.run_id
    CROSS JOIN chat_ids_list cil
    WHERE c.id = ANY(cil.chat_ids)
      AND m.role IN ('user'::message_type, 'assistant'::message_type)
      AND ab.sim_practice_simulation = true
    GROUP BY c.id
),
feedbacks_grouped AS (
    SELECT
        fe.grade_id as grade_id,
        COALESCE(
            ARRAY_AGG(
                (fe.id, fe.created_at, fsc.standard_id, fe.grade_id, fe.total::float, fe.feedback)::types.q_get_simulation_attempt_v4_feedback
            ),
            '{}'::types.q_get_simulation_attempt_v4_feedback[]
        ) as feedbacks
    FROM view_feedbacks_entry fe
    LEFT JOIN feedbacks_standards_connection fsc ON fsc.feedbacks_id = fe.id
    WHERE fe.grade_id IN (
        SELECT (gd.grade).id FROM grades_data gd
    )
    GROUP BY fe.grade_id
),
rubric_standard_groups_junction AS (
    SELECT 
        sg.id,
        sg.name,
        sg.short_name,
        sg.points,
        sg.pass_points,
        sg.description,
        rsg.rubric_id
    FROM attempt_base ab
    JOIN rubric_standard_groups_junction rsg ON rsg.rubric_id = ab.sim_rubric_id AND rsg.active = true
    JOIN standard_groups_resource sg ON sg.id = rsg.standard_group_id
    WHERE ab.sim_rubric_id IS NOT NULL
),
rubric_standards_grouped AS (
    SELECT 
        s.standard_group_id,
        array_agg(s.id::text) as standard_ids,
        ARRAY_AGG(
            (s.id, (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1), s.points, s.standard_group_id)::types.q_get_simulation_attempt_v4_standard
        ) as standards_list
    FROM standards_resource s
    WHERE s.standard_group_id IN (SELECT id FROM rubric_standard_groups_junction)
    GROUP BY s.standard_group_id
),
standards_mapping_merged AS (
    SELECT 
        ARRAY_AGG(
            (s.id, (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1), COALESCE((SELECT (SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1), ''), s.points)::types.q_get_simulation_attempt_v4_standard_mapping
        ) as standards_mapping
    FROM standards_resource s
    WHERE s.standard_group_id IN (SELECT id FROM rubric_standard_groups_junction)
),
rubric_structure_complete AS (
    SELECT 
        CASE 
            WHEN EXISTS (SELECT 1 FROM rubric_standard_groups_junction) THEN
                (COALESCE(
                    (SELECT ARRAY_AGG(
                        (rsg.id, rsgroup.standard_ids)::types.q_get_simulation_attempt_v4_standard_group_standards
                    )
                    FROM rubric_standard_groups_junction rsg
                    LEFT JOIN rubric_standards_grouped rsgroup ON rsgroup.standard_group_id = rsg.id),
                    '{}'::types.q_get_simulation_attempt_v4_standard_group_standards[]
                ),
                COALESCE(
                    (SELECT ARRAY_AGG(
                        (rsg.id, rsg.name, COALESCE(rsg.description, ''), rsg.points, rsg.pass_points)::types.q_get_simulation_attempt_v4_standard_group_mapping
                    )
                    FROM rubric_standard_groups_junction rsg),
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
            (d.id, (SELECT n.name FROM document_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1), ''::text, d.updated_at,
             COALESCE(SUBSTRING(u.file_path FROM '\\.([^\\.]+)$'), ''),
             COALESCE(
                 (SELECT array_agg(DISTINCT st.parent_id::text)
                  FROM scenario_documents_junction sd2
                  JOIN scenario_tree_junction st ON st.child_id = sd2.scenario_id AND st.parent_id = st.child_id
                  WHERE sd2.document_id = d.id AND sd2.active = true),
                 ARRAY[]::text[]
             ),
             false,
             false,
             EXISTS (SELECT 1 FROM document_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.document_id = d.id AND f.name = 'document_active' AND df.value = TRUE),
             COALESCE(
                 (SELECT array_agg(dd.department_id::text ORDER BY dd.created_at)
                  FROM document_departments_junction dd 
                  WHERE dd.document_id = d.id AND dd.active = true),
                 NULL::text[]
             ),
             u.file_path,
             u.mime_type,
             uuc.upload_id,
             COALESCE(
                 (SELECT array_agg(DISTINCT pfr.field_id::text)
                  FROM document_parameter_fields_junction dpfj
                  JOIN parameter_fields_resource pfr ON pfr.id = dpfj.parameter_field_id
                  WHERE dpfj.document_id = d.id AND dpfj.active = true),
                 ARRAY[]::text[]
             )
            )::types.q_get_simulation_attempt_v4_scenario_document
        ),
        '{}'::types.q_get_simulation_attempt_v4_scenario_document[]
    ) as scenario_documents_junction
    FROM document_artifact d
    JOIN document_documents_junction ddj ON ddj.document_id = d.id
    JOIN documents_resource dr ON dr.id = ddj.documents_id
    LEFT JOIN document_uploads_resource dur ON dur.document_id = d.id AND dur.active = true
    LEFT JOIN uploads_resource ur ON ur.id = dur.uploads_id
    LEFT JOIN uploads_uploads_connection uuc ON uuc.uploads_id = ur.id
    LEFT JOIN view_uploads_entry u ON u.id = uuc.upload_id
    JOIN scenario_documents_junction sd ON sd.document_id = dr.id
    CROSS JOIN scenario_ids_list sil
    WHERE sd.scenario_id = ANY(sil.scenario_ids) AND EXISTS (SELECT 1 FROM document_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.document_id = d.id AND f.name = 'document_active' AND df.value = true)
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
    CROSS JOIN rubric_standard_groups_junction rsg
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
            WHEN gd.grade IS NOT NULL AND EXISTS (SELECT 1 FROM rubric_standard_groups_junction) THEN
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
                     (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id JOIN attempt_base ab ON rp.rubric_id = ab.sim_rubric_id WHERE rp.type = 'total'::point_type LIMIT 1),
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
    JOIN standards_resource s ON s.id = fb.standard_id
    JOIN rubric_standard_groups_junction rsg ON rsg.id = s.standard_group_id
    GROUP BY gd.chat_id, s.standard_group_id, rsg.pass_points
),
grading_state_per_chat AS (
    SELECT 
        gd.chat_id,
        CASE 
            WHEN gd.grade IS NOT NULL AND EXISTS (SELECT 1 FROM rubric_standard_groups_junction) THEN
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
                    JOIN standards_resource s ON s.id = fb.standard_id
                    LEFT JOIN max_scores_per_group_chat mspgc
                        ON mspgc.chat_id = gd.chat_id
                        AND mspgc.standard_group_id = s.standard_group_id
                    WHERE fg3.grade_id = (gd.grade).id),
                    '{}'::types.q_get_simulation_attempt_v4_standard_pass[]
                ),
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
        (SELECT spr.value FROM simulation_scenario_positions_junction ssp
         CROSS JOIN attempt_base ab
         JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id
             WHERE ssp.simulation_id = ab.simulation_id
               AND spr.scenario_id = (cwad.chat_data).scenario.id
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
                     (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id JOIN attempt_base ab ON rp.rubric_id = ab.sim_rubric_id WHERE rp.type = 'total'::point_type LIMIT 1) * COUNT(*) FILTER (WHERE completed = true AND grade IS NOT NULL),
                     0
                 )::float,
                 CASE 
                     WHEN (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id JOIN attempt_base ab ON rp.rubric_id = ab.sim_rubric_id WHERE rp.type = 'total'::point_type LIMIT 1) > 0 
                        AND COUNT(*) FILTER (WHERE completed = true AND grade IS NOT NULL) > 0 THEN
                         TRUNC(
                             (SUM((grade).score::numeric) FILTER (WHERE completed = true AND grade IS NOT NULL)::numeric /
                              ((SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id JOIN attempt_base ab ON rp.rubric_id = ab.sim_rubric_id WHERE rp.type = 'total'::point_type LIMIT 1) * COUNT(*) FILTER (WHERE completed = true AND grade IS NOT NULL))::numeric) * 100.0,
                             2
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
    JOIN simulation_scenarios_junction ss ON ss.simulation_id = ab.simulation_id 
      AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id
          AND sfr.scenario_id = ss.scenario_id
          AND f.name = 'scenario_active' 
          AND ssf.value = true)
),
scenarios_with_completed_chats AS (
    SELECT DISTINCT ss.scenario_id as parent_scenario_id
    FROM params x
    JOIN attempt_base ab ON ab.id = x.attempt_id
    JOIN simulation_scenarios_junction ss ON ss.simulation_id = ab.simulation_id
      AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id
          AND sfr.scenario_id = ss.scenario_id
          AND f.name = 'scenario_active'
          AND ssf.value = true)
    JOIN all_chats sc ON sc.attempt_id = ab.id
    JOIN all_chat_scenarios acs5 ON acs5.chat_id = sc.id
    JOIN scenario_scenarios_junction ssj_scj5 ON ssj_scj5.scenarios_id = acs5.scenarios_id
    JOIN view_grades_entry scg ON scg.chat_id = sc.id
    WHERE COALESCE(
            (SELECT srm.root_scenario_id
             FROM scenario_root_mapping srm
             WHERE srm.child_scenario_id = ssj_scj5.scenario_id),
            ssj_scj5.scenario_id
        ) = ss.scenario_id
       OR ssj_scj5.scenario_id = ss.scenario_id
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
            (SELECT sp.value FROM scenario_positions_resource sp
             CROSS JOIN attempt_base ab
             JOIN unified_content uc ON uc.content_type = 'scenario'
             JOIN simulation_scenarios_junction ss ON ss.simulation_id = ab.simulation_id
               AND ss.scenario_id = (uc.chat_data).scenario.id
             WHERE EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id 
              AND sfr.scenario_id = ss.scenario_id 
              AND f.name = 'scenario_active' 
              AND ssf.value = true)
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
            COALESCE((SELECT title FROM all_chats WHERE id = pc.chat_id), 'Previous attempt') as title,
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
     sf.hints_enabled, sf.objectives_enabled, sf.image_input_enabled, sf.copy_paste_allowed,
     ab.sim_time_limit, ab.sim_rubric_id, ab.sim_created_at, ab.sim_updated_at)::types.q_get_simulation_attempt_v4_simulation as simulation,
    COALESCE(apd.attempt_profiles, '{}'::types.q_get_simulation_attempt_v4_attempt_profile[]) as attempt_profiles,
    COALESCE(
        (SELECT ARRAY_AGG(uc.chat_data ORDER BY uc.position, uc.created_at)
         FROM unified_content uc),
        '{}'::types.q_get_simulation_attempt_v4_chat_data[]
    ) as chats_entry,
    COALESCE(sdd.scenario_documents_junction, '{}'::types.q_get_simulation_attempt_v4_scenario_document[]) as scenario_documents_junction,
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
             (asswpc.scenario_data).created_at, (asswpc.scenario_data).updated_at, false,
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
CROSS JOIN simulation_flags_junction sf
CROSS JOIN scenario_documents_data sdd
CROSS JOIN aggregated_results_data ard
CROSS JOIN timer_data td
CROSS JOIN metadata_computed md
LEFT JOIN rubric_structure_complete rsc ON true
LEFT JOIN role_check rc ON true
$$;
