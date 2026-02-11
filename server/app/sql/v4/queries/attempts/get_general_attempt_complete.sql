-- Get general simulation attempt full details with all related entities
-- Uses optimized views instead of inline UNION ALL patterns
-- General-specific: includes cohort support, continuation options, previous chats
-- No hints data (practice-specific)

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_general_attempt_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_general_attempt_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
    max_iterations int := 10;
    iteration int := 0;
    types_dropped int;
BEGIN
    LOOP
        iteration := iteration + 1;
        types_dropped := 0;

        FOR r IN
            SELECT typname
            FROM pg_type
            WHERE typname LIKE 'q_get_general_attempt_v4_%'
              AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
            ORDER BY typname DESC
        LOOP
            BEGIN
                EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
                types_dropped := types_dropped + 1;
            EXCEPTION WHEN OTHERS THEN
                NULL;
            END;
        END LOOP;

        EXIT WHEN types_dropped = 0 OR iteration >= max_iterations;
    END LOOP;
END $$;

-- 3) Recreate types
-- Core types
CREATE TYPE types.q_get_general_attempt_v4_attempt AS (
    id uuid,
    created_at timestamptz,
    simulation_id uuid,
    infinite_mode boolean,
    archived boolean,
    profile_id uuid
);

CREATE TYPE types.q_get_general_attempt_v4_simulation AS (
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

CREATE TYPE types.q_get_general_attempt_v4_attempt_profile AS (
    profile_id uuid,
    attempt_id uuid,
    active boolean
);

CREATE TYPE types.q_get_general_attempt_v4_timer AS (
    elapsed int,
    "limit" int,
    exceeded boolean,
    formatted text
);

CREATE TYPE types.q_get_general_attempt_v4_aggregated_results AS (
    total_score float,
    total_possible_points float,
    percentage float,
    passed boolean,
    chats_completed int,
    total_chats int
);

-- Message feedback types
CREATE TYPE types.q_get_general_attempt_v4_replacements_entry AS (
    section text,
    replace text
);

CREATE TYPE types.q_get_general_attempt_v4_highlights_entry AS (
    section text
);

CREATE TYPE types.q_get_general_attempt_v4_message_feedback AS (
    id uuid,
    name text,
    description text,
    replaces types.q_get_general_attempt_v4_replacements_entry[],
    highlights types.q_get_general_attempt_v4_highlights_entry[]
);

CREATE TYPE types.q_get_general_attempt_v4_message AS (
    id uuid,
    created_at timestamptz,
    updated_at timestamptz,
    chat_id uuid,
    content text,
    type text,
    completed boolean,
    persona_id uuid,
    feedbacks types.q_get_general_attempt_v4_message_feedback[]
);

-- Grade types
CREATE TYPE types.q_get_general_attempt_v4_grade AS (
    id uuid,
    created_at timestamptz,
    simulation_chat_id uuid,
    rubric_id uuid,
    passed boolean,
    score int,
    time_taken int
);

-- Grading state types
CREATE TYPE types.q_get_general_attempt_v4_standard_achievement AS (
    standard_id uuid,
    achieved boolean
);

CREATE TYPE types.q_get_general_attempt_v4_standard_pass AS (
    standard_id uuid,
    passed boolean
);

CREATE TYPE types.q_get_general_attempt_v4_standard_feedback AS (
    standard_id uuid,
    feedback text
);

CREATE TYPE types.q_get_general_attempt_v4_grading_state AS (
    achieved_standards types.q_get_general_attempt_v4_standard_achievement[],
    passed_standards types.q_get_general_attempt_v4_standard_pass[],
    feedback_by_standard_id types.q_get_general_attempt_v4_standard_feedback[]
);

-- Dynamic rubric types
CREATE TYPE types.q_get_general_attempt_v4_skill_score AS (
    skill_name text,
    score float
);

CREATE TYPE types.q_get_general_attempt_v4_skill_feedback AS (
    skill_name text,
    feedback text
);

CREATE TYPE types.q_get_general_attempt_v4_dynamic_rubric AS (
    chat_id uuid,
    score float,
    passed boolean,
    time_taken float,
    skill_scores types.q_get_general_attempt_v4_skill_score[],
    skill_feedbacks types.q_get_general_attempt_v4_skill_feedback[],
    total_possible_points float
);

-- Previous chat types (general-specific)
CREATE TYPE types.q_get_general_attempt_v4_previous_chat AS (
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
CREATE TYPE types.q_get_general_attempt_v4_persona AS (
    id uuid,
    name text,
    icon text,
    color text
);

-- Scenario types
CREATE TYPE types.q_get_general_attempt_v4_scenario AS (
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

-- Chat types (no hints for general)
CREATE TYPE types.q_get_general_attempt_v4_chat AS (
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

CREATE TYPE types.q_get_general_attempt_v4_chat_data AS (
    chat types.q_get_general_attempt_v4_chat,
    scenario types.q_get_general_attempt_v4_scenario,
    messages types.q_get_general_attempt_v4_message[],
    grade types.q_get_general_attempt_v4_grade,
    grading_state types.q_get_general_attempt_v4_grading_state,
    dynamic_rubric types.q_get_general_attempt_v4_dynamic_rubric,
    previous_chats types.q_get_general_attempt_v4_previous_chat[],
    personas types.q_get_general_attempt_v4_persona[],
    content_type text
);

-- Document types
CREATE TYPE types.q_get_general_attempt_v4_scenario_document AS (
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

-- Rubric structure types
CREATE TYPE types.q_get_general_attempt_v4_standard_group_mapping AS (
    standard_group_id uuid,
    name text,
    description text,
    points float,
    pass_points float
);

CREATE TYPE types.q_get_general_attempt_v4_standard_mapping AS (
    standard_id uuid,
    name text,
    description text,
    points float
);

CREATE TYPE types.q_get_general_attempt_v4_standard_group_standards AS (
    standard_group_id uuid,
    standard_ids text[]
);

CREATE TYPE types.q_get_general_attempt_v4_rubric_structure AS (
    standard_groups types.q_get_general_attempt_v4_standard_group_standards[],
    standard_groups_mapping types.q_get_general_attempt_v4_standard_group_mapping[],
    standards_mapping types.q_get_general_attempt_v4_standard_mapping[]
);

-- Continuation option types (general-specific)
CREATE TYPE types.q_get_general_attempt_v4_continuation_option AS (
    scenario_id uuid,
    position int,
    scenario_name text,
    previous_chat_id uuid,
    title text,
    score float,
    percentage float,
    time_taken float
);

CREATE TYPE types.q_get_general_attempt_v4_available_continuation_options AS (
    next_sequential_options types.q_get_general_attempt_v4_continuation_option[],
    has_options boolean
);

-- All simulation scenario types
CREATE TYPE types.q_get_general_attempt_v4_all_simulation_scenario AS (
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
    previous_chats types.q_get_general_attempt_v4_previous_chat[]
);

-- Feedback type
CREATE TYPE types.q_get_general_attempt_v4_feedback AS (
    id uuid,
    created_at timestamptz,
    standard_id uuid,
    grade_id uuid,
    total float,
    feedback text
);

-- Standard type
CREATE TYPE types.q_get_general_attempt_v4_standard AS (
    id uuid,
    name text,
    points float,
    standard_group_id uuid
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_general_attempt_v4(
    attempt_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    attempt_exists boolean,
    actor_name text,
    access_denied boolean,
    attempt types.q_get_general_attempt_v4_attempt,
    simulation types.q_get_general_attempt_v4_simulation,
    attempt_profiles types.q_get_general_attempt_v4_attempt_profile[],
    chats_entry types.q_get_general_attempt_v4_chat_data[],
    scenario_documents_junction types.q_get_general_attempt_v4_scenario_document[],
    aggregated_results types.q_get_general_attempt_v4_aggregated_results,
    timer types.q_get_general_attempt_v4_timer,
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
    rubric_structure types.q_get_general_attempt_v4_rubric_structure,
    all_simulation_scenarios types.q_get_general_attempt_v4_all_simulation_scenario[],
    available_continuation_options types.q_get_general_attempt_v4_available_continuation_options
)
LANGUAGE sql
STABLE
AS $$
WITH
params AS (
    SELECT
        attempt_id AS attempt_id,
        profile_id AS profile_id
),
-- Check if attempt exists in view_simulation_attempts_entry only
attempt_exists_check AS (
    SELECT EXISTS(
        SELECT 1 FROM view_simulation_attempts_entry WHERE id = (SELECT attempt_id FROM params) AND active = true
    )::boolean as attempt_exists
),
-- Get actor profile name
actor_profile AS (
    SELECT
        p.id as profile_id,
        COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
-- Use optimized view for attempt + simulation context
attempt_context AS (
    SELECT *
    FROM view_attempt_simulation_context_complete vasc
    WHERE vasc.attempt_id = (SELECT attempt_id FROM params)
      AND vasc.attempt_type = 'general'
),
-- Get attempt profiles
attempt_profiles_data AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (ppj.profile_id, ac.attempt_id, true)::types.q_get_general_attempt_v4_attempt_profile
        ),
        '{}'::types.q_get_general_attempt_v4_attempt_profile[]
    ) as attempt_profiles
    FROM attempt_context ac
    JOIN simulation_attempts_profiles_connection apc ON apc.attempt_id = ac.attempt_id
    JOIN profile_profiles_junction ppj ON ppj.profiles_id = apc.profiles_id
),
current_attempt_profile AS (
    SELECT ppj.profile_id
    FROM attempt_context ac
    JOIN simulation_attempts_profiles_connection apc ON apc.attempt_id = ac.attempt_id
    JOIN profile_profiles_junction ppj ON ppj.profiles_id = apc.profiles_id
    LIMIT 1
),
-- Role-based access control
role_check AS (
    SELECT
        CASE
            WHEN cap.profile_id IS NOT NULL AND x.profile_id IS NOT NULL THEN
                CASE
                    WHEN attempt_role_level > current_role_level THEN true
                    ELSE false
                END
            ELSE false
        END as access_denied
    FROM params x
    CROSS JOIN current_attempt_profile cap
    CROSS JOIN LATERAL (
        SELECT
            CASE
                WHEN (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = cap.profile_id LIMIT 1)::text = 'superadmin' THEN 5
                WHEN (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = cap.profile_id LIMIT 1)::text = 'admin' THEN 4
                WHEN (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = cap.profile_id LIMIT 1)::text = 'instructional' THEN 3
                WHEN (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = cap.profile_id LIMIT 1)::text = 'member' THEN 2
                ELSE 1
            END as attempt_role_level
    ) attempt_profile_type_info
    CROSS JOIN LATERAL (
        SELECT
            CASE
                WHEN (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = x.profile_id LIMIT 1)::text = 'superadmin' THEN 5
                WHEN (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = x.profile_id LIMIT 1)::text = 'admin' THEN 4
                WHEN (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = x.profile_id LIMIT 1)::text = 'instructional' THEN 3
                WHEN (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = x.profile_id LIMIT 1)::text = 'member' THEN 2
                ELSE 1
            END as current_role_level
    ) current_user_role_info
),
-- Get simulation scenarios list
simulation_scenarios_list AS (
    SELECT
        ss.scenario_id,
        (SELECT spr.value FROM simulation_scenario_positions_junction ssp
         JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id
         WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1) as position
    FROM attempt_context ac
    JOIN simulation_scenarios_junction ss ON ss.simulation_id = ac.simulation_id
      AND EXISTS (
          SELECT 1 FROM simulation_scenario_flags_junction ssf
          JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id
          JOIN flags_resource f ON sfr.flag_id = f.id
          WHERE ssf.simulation_id = ss.simulation_id
            AND sfr.scenario_id = ss.scenario_id
            AND f.name = 'simulation_active'
            AND ssf.value = true
      )
    ORDER BY position
),
-- Use optimized view for chats with scenario context
chats_with_context AS (
    SELECT csc.*
    FROM view_chat_scenario_context_complete csc
    JOIN view_simulation_chats_entry gce ON gce.id = csc.chat_id
    WHERE csc.attempt_id = (SELECT attempt_id FROM params)
      AND csc.chat_type = 'general'
    ORDER BY csc.chat_created_at
),
-- Get chat IDs list
chat_ids_list AS (
    SELECT array_agg(chat_id ORDER BY chat_created_at) as chat_ids
    FROM chats_with_context
),
-- Get scenario IDs list
scenario_ids_list AS (
    SELECT array_agg(DISTINCT scenario_id) as scenario_ids
    FROM chats_with_context
),
-- Scenario root mapping for parent scenarios
scenario_root_mapping AS (
    WITH RECURSIVE scenario_ancestors AS (
        SELECT DISTINCT
            cwc.scenario_id as child_scenario_id,
            cwc.scenario_id as ancestor_id,
            0 as depth
        FROM chats_with_context cwc

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
-- Previous chats from other attempts by same profile (general-specific)
previous_chats_with_grades AS (
    SELECT DISTINCT ON (gc.id)
        gc.id as chat_id,
        ssj_scj.scenario_id as child_scenario_id,
        COALESCE(
            (SELECT srm.root_scenario_id FROM scenario_root_mapping srm WHERE srm.child_scenario_id = ssj_scj.scenario_id),
            ssj_scj.scenario_id
        ) as parent_scenario_id,
        gc.attempt_id,
        ssj2.simulation_id,
        gc.title,
        gc.created_at,
        gg.score,
        gg.passed,
        COALESCE(gg.time_taken, 0) as time_taken,
        COALESCE(gg.total_points, 0) as total_points
    FROM params x
    CROSS JOIN current_attempt_profile cap
    CROSS JOIN simulation_scenarios_list ssl
    JOIN simulation_attempts_profiles_connection apc ON apc.profiles_id = (SELECT profiles_id FROM profile_profiles_junction WHERE profile_id = cap.profile_id LIMIT 1)
    JOIN view_simulation_attempts_entry ga ON ga.id = apc.attempt_id AND ga.active = true
    JOIN simulation_attempts_simulations_connection asc_conn ON asc_conn.attempt_id = ga.id
    JOIN simulation_simulations_junction ssj2 ON ssj2.simulations_id = asc_conn.simulations_id
    JOIN view_simulation_chats_entry gc ON gc.attempt_id = ga.id AND gc.completed = true AND gc.active = true
    JOIN mv_attempt_chats csc ON csc.chat_id = gc.id
    JOIN scenario_scenarios_junction ssj_scj ON ssj_scj.scenarios_id = csc.scenario_id
    JOIN view_simulation_grades_entry gg ON gg.chat_id = gc.id AND gg.active = true
    WHERE gc.attempt_id != x.attempt_id
      AND (
          COALESCE(
              (SELECT srm.root_scenario_id FROM scenario_root_mapping srm WHERE srm.child_scenario_id = ssj_scj.scenario_id),
              ssj_scj.scenario_id
          ) = ssl.scenario_id
          OR ssj_scj.scenario_id = ssl.scenario_id
      )
    ORDER BY gc.id, gg.created_at DESC NULLS LAST
),
previous_chats_for_scenarios AS (
    SELECT
        pwg.parent_scenario_id as scenario_id,
        COALESCE(
            ARRAY_AGG(
                (pwg.chat_id, pwg.attempt_id, pwg.score::float, pwg.passed, pwg.created_at, pwg.title,
                 COALESCE(pwg.time_taken, 0)::float,
                 COALESCE(pwg.total_points, 0)::float,
                 CASE
                     WHEN pwg.score IS NOT NULL AND pwg.total_points > 0 THEN
                         TRUNC((pwg.score::numeric / pwg.total_points::numeric) * 100.0, 2)::float
                     ELSE NULL::float
                 END
                )::types.q_get_general_attempt_v4_previous_chat
                ORDER BY pwg.created_at DESC
            ),
            '{}'::types.q_get_general_attempt_v4_previous_chat[]
        ) as previous_chats
    FROM previous_chats_with_grades pwg
    GROUP BY pwg.parent_scenario_id
),
-- Messages with tree traversal
messages_with_tree AS (
    WITH RECURSIVE message_path AS (
        SELECT
            m.id,
            cwc.chat_id,
            CASE WHEN m.role = 'user'::message_type THEN 'query' ELSE 'response' END as type,
            ce.content,
            m.created_at,
            m.completed,
            m.updated_at,
            NULL::uuid AS persona_id,
            0 as depth,
            m.id as path_root_id
        FROM chats_with_context cwc
        JOIN view_simulation_messages_entry m ON m.chat_id = cwc.chat_id AND m.active = true
        JOIN view_runs_entry r ON r.id = m.run_id
        LEFT JOIN LATERAL (
            SELECT content
            FROM simulation_contents_entry ce
            WHERE ce.message_id = m.id
              AND ce.active = true
            ORDER BY ce.created_at
            LIMIT 1
        ) ce ON TRUE
        WHERE m.role IN ('user'::message_type, 'assistant'::message_type)
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
        WHERE mp.depth < 1000
          AND m.role IN ('user'::message_type, 'assistant'::message_type)
          AND m.active = true
    ),
    messages_without_parents AS (
        SELECT
            m.id,
            cwc.chat_id,
            CASE WHEN m.role = 'user'::message_type THEN 'query' ELSE 'response' END as type,
            ce.content,
            m.created_at,
            m.completed,
            m.updated_at,
            NULL::uuid AS persona_id,
            -1 as depth,
            m.id as path_root_id
        FROM chats_with_context cwc
        JOIN view_simulation_messages_entry m ON m.chat_id = cwc.chat_id AND m.active = true
        JOIN view_runs_entry r ON r.id = m.run_id
        LEFT JOIN LATERAL (
            SELECT content
            FROM simulation_contents_entry ce
            WHERE ce.message_id = m.id
              AND ce.active = true
            ORDER BY ce.created_at
            LIMIT 1
        ) ce ON TRUE
        WHERE m.role IN ('user'::message_type, 'assistant'::message_type)
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
        id, chat_id, type, content, created_at, completed, updated_at, persona_id
    FROM all_messages
    ORDER BY id, chat_id, created_at
),
-- Get grades using optimized view
grades_data AS (
    SELECT DISTINCT ON (cwc.chat_id)
        cwc.chat_id,
        (gg.id, gg.created_at, cwc.chat_id,
         COALESCE(grc.rubrics_id, ac.simulation_rubric_id),
         gg.passed, gg.score, COALESCE(gg.time_taken, 0)
        )::types.q_get_general_attempt_v4_grade as grade
    FROM chats_with_context cwc
    CROSS JOIN attempt_context ac
    JOIN view_simulation_grades_entry gg ON gg.chat_id = cwc.chat_id AND gg.active = true
    LEFT JOIN simulation_grades_rubrics_connection grc ON grc.grade_id = gg.id
    ORDER BY cwc.chat_id, gg.created_at DESC
),
-- Message feedbacks
message_feedbacks_data AS (
    SELECT
        se.message_id,
        se.grade_id,
        (se.id, se.name, se.description,
         '{}'::types.q_get_general_attempt_v4_replacements_entry[],
         COALESCE(
             (SELECT ARRAY_AGG((mfh.section)::types.q_get_general_attempt_v4_highlights_entry ORDER BY mfh.idx)
              FROM view_highlights_entry mfh
              WHERE mfh.message_feedback_id = se.id),
             '{}'::types.q_get_general_attempt_v4_highlights_entry[]
         )
        )::types.q_get_general_attempt_v4_message_feedback as feedback_data
    FROM view_strengths_entry se
    WHERE se.grade_id IN (SELECT (gd.grade).id FROM grades_data gd)
    UNION ALL
    SELECT
        ie.message_id,
        ie.grade_id,
        (ie.id, ie.name, ie.description,
         COALESCE(
             (SELECT ARRAY_AGG((mfr.section, mfr.replace)::types.q_get_general_attempt_v4_replacements_entry ORDER BY mfr.idx)
              FROM view_replacements_entry mfr
              WHERE mfr.message_feedback_id = ie.id),
             '{}'::types.q_get_general_attempt_v4_replacements_entry[]
         ),
         '{}'::types.q_get_general_attempt_v4_highlights_entry[]
        )::types.q_get_general_attempt_v4_message_feedback as feedback_data
    FROM view_improvements_entry ie
    WHERE ie.grade_id IN (SELECT (gd.grade).id FROM grades_data gd)
),
message_feedbacks_grouped AS (
    SELECT
        mfd.message_id,
        COALESCE(
            ARRAY_AGG(mfd.feedback_data ORDER BY (mfd.feedback_data).id),
            '{}'::types.q_get_general_attempt_v4_message_feedback[]
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
                 COALESCE(mfg.feedbacks, '{}'::types.q_get_general_attempt_v4_message_feedback[])
                )::types.q_get_general_attempt_v4_message
                ORDER BY mwt.created_at
            ),
            '{}'::types.q_get_general_attempt_v4_message[]
        ) as messages
    FROM messages_with_tree mwt
    LEFT JOIN message_feedbacks_grouped mfg ON mfg.message_id = mwt.id
    GROUP BY mwt.chat_id
),
-- Personas per chat
personas_per_chat AS (
    SELECT
        cwc.chat_id,
        COALESCE(
            ARRAY_AGG(
                (p.id,
                 (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1),
                 (SELECT i.value FROM persona_icons_junction pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1),
                 (SELECT c.hex_code FROM persona_colors_junction pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1)
                )::types.q_get_general_attempt_v4_persona
            ) FILTER (WHERE p.id IS NOT NULL),
            '{}'::types.q_get_general_attempt_v4_persona[]
        ) as personas
    FROM chats_with_context cwc
    LEFT JOIN scenario_personas_junction sp ON sp.scenario_id = cwc.scenario_id AND sp.active = true
    LEFT JOIN personas_resource p ON p.id = sp.persona_id
      AND EXISTS (SELECT 1 FROM persona_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id
                  WHERE pf.persona_id = p.id AND f.name = 'persona_active' AND pf.value = true)
    GROUP BY cwc.chat_id
),
-- Feedbacks grouped
feedbacks_grouped AS (
    SELECT
        fe.grade_id,
        COALESCE(
            ARRAY_AGG(
                (fe.id, fe.created_at, fsc.standard_id, fe.grade_id, fe.total::float, fe.feedback)::types.q_get_general_attempt_v4_feedback
            ),
            '{}'::types.q_get_general_attempt_v4_feedback[]
        ) as feedbacks
    FROM view_feedbacks_entry fe
    LEFT JOIN feedbacks_standards_connection fsc ON fsc.feedbacks_id = fe.id
    WHERE fe.grade_id IN (SELECT (gd.grade).id FROM grades_data gd)
    GROUP BY fe.grade_id
),
-- Rubric standard groups
rubric_standard_groups_junction AS (
    SELECT sg.id, sg.name, sg.short_name, sg.points, sg.pass_points, sg.description, rsg.rubric_id
    FROM attempt_context ac
    JOIN rubric_standard_groups_junction rsg ON rsg.rubric_id = ac.simulation_rubric_id AND rsg.active = true
    JOIN standard_groups_resource sg ON sg.id = rsg.standard_group_id
    WHERE ac.simulation_rubric_id IS NOT NULL
),
rubric_standards_grouped AS (
    SELECT
        s.standard_group_id,
        array_agg(s.id::text) as standard_ids,
        ARRAY_AGG(
            (s.id, (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1), s.points, s.standard_group_id)::types.q_get_general_attempt_v4_standard
        ) as standards_list
    FROM standards_resource s
    WHERE s.standard_group_id IN (SELECT id FROM rubric_standard_groups_junction)
    GROUP BY s.standard_group_id
),
-- Grading state per chat
grading_state_per_chat AS (
    SELECT
        gd.chat_id,
        CASE
            WHEN gd.grade IS NOT NULL AND EXISTS (SELECT 1 FROM rubric_standard_groups_junction) THEN
                (
                    COALESCE(
                        (SELECT ARRAY_AGG((fb.standard_id, true)::types.q_get_general_attempt_v4_standard_achievement)
                         FROM feedbacks_grouped fg2
                         CROSS JOIN LATERAL unnest(COALESCE(fg2.feedbacks, '{}'::types.q_get_general_attempt_v4_feedback[])) fb
                         WHERE fg2.grade_id = (gd.grade).id),
                        '{}'::types.q_get_general_attempt_v4_standard_achievement[]
                    ),
                    COALESCE(
                        (SELECT ARRAY_AGG((fb.standard_id, true)::types.q_get_general_attempt_v4_standard_pass)
                         FROM feedbacks_grouped fg3
                         CROSS JOIN LATERAL unnest(COALESCE(fg3.feedbacks, '{}'::types.q_get_general_attempt_v4_feedback[])) fb
                         WHERE fg3.grade_id = (gd.grade).id),
                        '{}'::types.q_get_general_attempt_v4_standard_pass[]
                    ),
                    COALESCE(
                        (SELECT ARRAY_AGG((fb.standard_id, fb.feedback)::types.q_get_general_attempt_v4_standard_feedback)
                         FROM feedbacks_grouped fg4
                         CROSS JOIN LATERAL unnest(COALESCE(fg4.feedbacks, '{}'::types.q_get_general_attempt_v4_feedback[])) fb
                         WHERE fg4.grade_id = (gd.grade).id),
                        '{}'::types.q_get_general_attempt_v4_standard_feedback[]
                    )
                )::types.q_get_general_attempt_v4_grading_state
            ELSE NULL
        END as grading_state
    FROM grades_data gd
),
-- Dynamic rubric per chat
dynamic_rubric_per_chat AS (
    SELECT
        gd.chat_id,
        CASE
            WHEN gd.grade IS NOT NULL AND EXISTS (SELECT 1 FROM rubric_standard_groups_junction) THEN
                (gd.chat_id,
                 (gd.grade).score::float,
                 (gd.grade).passed,
                 (gd.grade).time_taken::float,
                 '{}'::types.q_get_general_attempt_v4_skill_score[],
                 '{}'::types.q_get_general_attempt_v4_skill_feedback[],
                 COALESCE(
                     (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id
                      JOIN attempt_context ac ON rp.rubric_id = ac.simulation_rubric_id WHERE rp.type = 'total'::point_type LIMIT 1),
                     0
                 )::float
                )::types.q_get_general_attempt_v4_dynamic_rubric
            ELSE NULL
        END as dynamic_rubric
    FROM grades_data gd
),
-- Build chats with all data
chats_with_all_data AS (
    SELECT
        cwc.chat_id,
        COALESCE(
            (SELECT srm.root_scenario_id FROM scenario_root_mapping srm WHERE srm.child_scenario_id = cwc.scenario_id),
            cwc.scenario_id
        ) as parent_scenario_id,
        ((cwc.chat_id, cwc.chat_created_at, cwc.chat_updated_at, cwc.chat_title, cwc.scenario_id,
          COALESCE((SELECT srm.root_scenario_id FROM scenario_root_mapping srm WHERE srm.child_scenario_id = cwc.scenario_id), cwc.scenario_id),
          cwc.attempt_id, cwc.chat_completed,
          CASE WHEN cwc.chat_completed AND gd.grade IS NOT NULL THEN (gd.grade).created_at ELSE NULL END,
          NULL::text, cwc.document_ids)::types.q_get_general_attempt_v4_chat,
         (cwc.scenario_id, cwc.scenario_name, COALESCE(cwc.problem_statement, ''), cwc.scenario_department_id,
          cwc.scenario_active, cwc.persona_id, cwc.persona_name, cwc.persona_icon, cwc.persona_color,
          cwc.chat_created_at, cwc.chat_updated_at, false, false, cwc.copy_paste_allowed,
          cwc.text_enabled, cwc.audio_enabled, cwc.show_problem_statement, cwc.show_objectives,
          cwc.show_images, cwc.background_image_upload_id, cwc.objectives)::types.q_get_general_attempt_v4_scenario,
         COALESCE(mg.messages, '{}'::types.q_get_general_attempt_v4_message[]),
         gd.grade,
         COALESCE(gspc.grading_state, NULL::types.q_get_general_attempt_v4_grading_state),
         drpc.dynamic_rubric,
         COALESCE(
             (SELECT previous_chats FROM previous_chats_for_scenarios pcf2
              WHERE pcf2.scenario_id = COALESCE((SELECT srm.root_scenario_id FROM scenario_root_mapping srm WHERE srm.child_scenario_id = cwc.scenario_id), cwc.scenario_id)),
             '{}'::types.q_get_general_attempt_v4_previous_chat[]
         ),
         COALESCE(ppc.personas, '{}'::types.q_get_general_attempt_v4_persona[]),
         'scenario'::text
        )::types.q_get_general_attempt_v4_chat_data as chat_data,
        cwc.chat_completed as completed,
        cwc.chat_created_at as created_at,
        gd.grade,
        COALESCE(
            (SELECT spr.value FROM simulation_scenario_positions_junction ssp
             JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id
             CROSS JOIN attempt_context ac
             WHERE ssp.simulation_id = ac.simulation_id AND spr.scenario_id = cwc.scenario_id
             LIMIT 1),
            1
        ) as position
    FROM chats_with_context cwc
    LEFT JOIN messages_grouped mg ON mg.chat_id = cwc.chat_id
    LEFT JOIN grades_data gd ON gd.chat_id = cwc.chat_id
    LEFT JOIN grading_state_per_chat gspc ON gspc.chat_id = cwc.chat_id
    LEFT JOIN dynamic_rubric_per_chat drpc ON drpc.chat_id = cwc.chat_id
    LEFT JOIN personas_per_chat ppc ON ppc.chat_id = cwc.chat_id
),
-- Scenario documents
scenario_documents_data AS (
    SELECT COALESCE(
        ARRAY_AGG(DISTINCT
            (d.id, (SELECT n.name FROM document_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1), ''::text, d.updated_at,
             COALESCE(SUBSTRING(u.file_path FROM '\\.([^\\.]+)$'), ''),
             ARRAY[]::text[], false, false,
             EXISTS (SELECT 1 FROM document_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.document_id = d.id AND f.name = 'document_active' AND df.value = TRUE),
             NULL::text[], u.file_path, u.mime_type, uuc.upload_id, ARRAY[]::text[]
            )::types.q_get_general_attempt_v4_scenario_document
        ),
        '{}'::types.q_get_general_attempt_v4_scenario_document[]
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
    WHERE sd.scenario_id = ANY(sil.scenario_ids)
      AND EXISTS (SELECT 1 FROM document_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.document_id = d.id AND f.name = 'document_active' AND df.value = true)
),
-- Aggregated results
aggregated_results_data AS (
    SELECT
        CASE
            WHEN COUNT(*) FILTER (WHERE completed = true AND grade IS NOT NULL) > 0 THEN
                (COALESCE(SUM((grade).score::numeric) FILTER (WHERE completed = true AND grade IS NOT NULL), 0)::float,
                 COALESCE(
                     (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id
                      JOIN attempt_context ac ON rp.rubric_id = ac.simulation_rubric_id WHERE rp.type = 'total'::point_type LIMIT 1)
                     * COUNT(*) FILTER (WHERE completed = true AND grade IS NOT NULL),
                     0
                 )::float,
                 CASE
                     WHEN (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id
                           JOIN attempt_context ac ON rp.rubric_id = ac.simulation_rubric_id WHERE rp.type = 'total'::point_type LIMIT 1) > 0
                        AND COUNT(*) FILTER (WHERE completed = true AND grade IS NOT NULL) > 0 THEN
                         TRUNC(
                             (SUM((grade).score::numeric) FILTER (WHERE completed = true AND grade IS NOT NULL)::numeric /
                              ((SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id
                                JOIN attempt_context ac ON rp.rubric_id = ac.simulation_rubric_id WHERE rp.type = 'total'::point_type LIMIT 1)
                               * COUNT(*) FILTER (WHERE completed = true AND grade IS NOT NULL))::numeric) * 100.0,
                             2
                         )::float
                     ELSE 0.0
                 END,
                 BOOL_AND((grade).passed) FILTER (WHERE completed = true AND grade IS NOT NULL),
                 COUNT(*) FILTER (WHERE completed = true AND grade IS NOT NULL)::int,
                 COUNT(*)::int
                )::types.q_get_general_attempt_v4_aggregated_results
            ELSE NULL
        END as aggregated_results
    FROM chats_with_all_data
),
-- Timer data
elapsed_time_calc AS (
    SELECT COALESCE(
        SUM(
            CASE
                WHEN cwad.completed AND cwad.grade IS NOT NULL THEN (cwad.grade).time_taken::integer
                WHEN cwad.completed THEN EXTRACT(EPOCH FROM ((cwad.grade).created_at - cwad.created_at))::integer
                ELSE EXTRACT(EPOCH FROM (NOW() - cwad.created_at))::integer
            END
        ), 0
    ) as total_elapsed
    FROM chats_with_all_data cwad
),
timer_data AS (
    SELECT
        (etc.total_elapsed::int,
         CASE WHEN ac.simulation_time_limit IS NOT NULL THEN (ac.simulation_time_limit * 60)::int ELSE NULL END,
         CASE
             WHEN ac.infinite_mode AND ac.simulation_time_limit IS NOT NULL THEN
                 (GREATEST((ac.simulation_time_limit * 60) - etc.total_elapsed, 0) <= 0)
             WHEN ac.simulation_time_limit IS NOT NULL THEN
                 ((ac.simulation_time_limit * 60) - etc.total_elapsed < 0)
             ELSE false
         END,
         CASE
             WHEN ac.simulation_time_limit IS NOT NULL THEN
                 CONCAT(
                     FLOOR(GREATEST((ac.simulation_time_limit * 60) - etc.total_elapsed, 0) / 3600)::text, 'h ',
                     FLOOR((GREATEST((ac.simulation_time_limit * 60) - etc.total_elapsed, 0) % 3600) / 60)::text, 'm ',
                     (GREATEST((ac.simulation_time_limit * 60) - etc.total_elapsed, 0) % 60)::text, 's'
                 )
             ELSE ''
         END
        )::types.q_get_general_attempt_v4_timer as timer
    FROM attempt_context ac
    CROSS JOIN elapsed_time_calc etc
),
-- Rubric structure
rubric_structure_complete AS (
    SELECT
        CASE
            WHEN EXISTS (SELECT 1 FROM rubric_standard_groups_junction) THEN
                (COALESCE(
                    (SELECT ARRAY_AGG((rsg.id, rsgroup.standard_ids)::types.q_get_general_attempt_v4_standard_group_standards)
                     FROM rubric_standard_groups_junction rsg
                     LEFT JOIN rubric_standards_grouped rsgroup ON rsgroup.standard_group_id = rsg.id),
                    '{}'::types.q_get_general_attempt_v4_standard_group_standards[]
                ),
                COALESCE(
                    (SELECT ARRAY_AGG((rsg.id, rsg.name, COALESCE(rsg.description, ''), rsg.points, rsg.pass_points)::types.q_get_general_attempt_v4_standard_group_mapping)
                     FROM rubric_standard_groups_junction rsg),
                    '{}'::types.q_get_general_attempt_v4_standard_group_mapping[]
                ),
                COALESCE(
                    (SELECT ARRAY_AGG((s.id, (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1), '', s.points)::types.q_get_general_attempt_v4_standard_mapping)
                     FROM standards_resource s WHERE s.standard_group_id IN (SELECT id FROM rubric_standard_groups_junction)),
                    '{}'::types.q_get_general_attempt_v4_standard_mapping[]
                ))::types.q_get_general_attempt_v4_rubric_structure
            ELSE NULL
        END as rubric_structure
),
-- All simulation scenarios with previous chats
all_simulation_scenarios_with_previous_chats AS (
    SELECT
        ssl.scenario_id,
        ssl.position,
        s.id,
        (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1) as scenario_name,
        COALESCE((SELECT ps.problem_statement FROM scenario_problem_statements_junction sps JOIN problem_statements_resource ps ON ps.id = sps.problem_statement_id WHERE sps.scenario_id = s.id AND sps.active = true LIMIT 1), '') as problem_statement,
        (SELECT department_id FROM scenario_departments_junction sd WHERE sd.scenario_id = s.id AND sd.active = true ORDER BY sd.created_at LIMIT 1) as scenario_department_id,
        sp.persona_id,
        (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1) as persona_name,
        (SELECT i.value FROM persona_icons_junction pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1) as persona_icon,
        (SELECT c.hex_code FROM persona_colors_junction pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1) as persona_color,
        s.created_at,
        COALESCE(pcf.previous_chats, '{}'::types.q_get_general_attempt_v4_previous_chat[]) as previous_chats
    FROM simulation_scenarios_list ssl
    JOIN scenarios_resource s ON s.id = ssl.scenario_id
    LEFT JOIN scenario_personas_junction sp ON sp.scenario_id = s.id AND sp.active = true
    LEFT JOIN personas_resource p ON p.id = sp.persona_id
    LEFT JOIN previous_chats_for_scenarios pcf ON pcf.scenario_id = ssl.scenario_id
),
-- Available continuation options (general-specific)
available_continuation_options AS (
    WITH current_scenario_position AS (
        SELECT COALESCE(
            (SELECT cwad.position FROM chats_with_all_data cwad WHERE cwad.completed = false ORDER BY cwad.position, cwad.created_at LIMIT 1),
            1
        ) as current_position
    ),
    valid_next_scenarios AS (
        SELECT asswpc.scenario_id, asswpc.position, asswpc.scenario_name, asswpc.previous_chats
        FROM all_simulation_scenarios_with_previous_chats asswpc
        CROSS JOIN current_scenario_position csp
        WHERE asswpc.position >= csp.current_position
          AND array_length(COALESCE(asswpc.previous_chats, '{}'::types.q_get_general_attempt_v4_previous_chat[]), 1) > 0
        ORDER BY asswpc.position
    ),
    scenario_options_expanded AS (
        SELECT
            vns.scenario_id, vns.position, vns.scenario_name,
            pc.chat_id as previous_chat_id,
            COALESCE((SELECT title FROM view_simulation_chats_entry WHERE id = pc.chat_id), 'Previous attempt') as title,
            pc.score, pc.percentage, pc.time_taken
        FROM valid_next_scenarios vns
        CROSS JOIN LATERAL unnest(COALESCE(vns.previous_chats, '{}'::types.q_get_general_attempt_v4_previous_chat[])) pc
    )
    SELECT
        COALESCE(
            ARRAY_AGG(
                (soe.scenario_id, soe.position, soe.scenario_name, soe.previous_chat_id, soe.title, soe.score, soe.percentage, soe.time_taken)::types.q_get_general_attempt_v4_continuation_option
                ORDER BY soe.position, soe.score DESC NULLS LAST
            ),
            '{}'::types.q_get_general_attempt_v4_continuation_option[]
        ) as next_sequential_options,
        CASE WHEN COUNT(*) > 0 THEN true ELSE false END as has_options
    FROM scenario_options_expanded soe
),
-- Metadata computed
scenarios_with_completed_chats AS (
    SELECT DISTINCT cwad.parent_scenario_id
    FROM chats_with_all_data cwad
    WHERE cwad.completed = true AND cwad.grade IS NOT NULL
),
metadata_computed AS (
    SELECT
        COALESCE(
            (SELECT row_num - 1
             FROM (SELECT chat_id, completed, ROW_NUMBER() OVER (ORDER BY position, created_at) as row_num FROM chats_with_all_data) ranked
             WHERE completed = false ORDER BY row_num LIMIT 1),
            0
        ) as current_chat_index,
        COALESCE((SELECT COUNT(*) FROM simulation_scenarios_list), (SELECT COUNT(*) FROM chats_with_all_data))::integer as expected_chat_count,
        (SELECT COUNT(*) FROM chats_with_all_data) = 1 as is_single_chat_attempt,
        CASE
            WHEN (SELECT infinite_mode FROM attempt_context) THEN false
            ELSE COALESCE(
                (SELECT row_num - 1
                 FROM (SELECT chat_id, completed, ROW_NUMBER() OVER (ORDER BY position, created_at) as row_num FROM chats_with_all_data) ranked
                 WHERE completed = false ORDER BY row_num LIMIT 1),
                0
            ) = COALESCE((SELECT COUNT(*) FROM simulation_scenarios_list), (SELECT COUNT(*) FROM chats_with_all_data)) - 1
        END as is_last_attempt,
        COALESCE((SELECT BOOL_AND(completed) FROM chats_with_all_data), false) as show_results,
        CASE
            WHEN (SELECT COUNT(*) FROM simulation_scenarios_list) = 0 THEN false
            ELSE COALESCE(
                (SELECT COUNT(DISTINCT ssl.scenario_id) FROM simulation_scenarios_list ssl
                 LEFT JOIN scenarios_with_completed_chats swcc ON swcc.parent_scenario_id = ssl.scenario_id
                 WHERE swcc.parent_scenario_id IS NULL) > 0,
                true
            )
        END as should_show_controls,
        COALESCE(
            (SELECT COUNT(DISTINCT ssl.scenario_id) FROM simulation_scenarios_list ssl
             LEFT JOIN scenarios_with_completed_chats swcc ON swcc.parent_scenario_id = ssl.scenario_id
             WHERE swcc.parent_scenario_id IS NULL),
            0
        )::integer as remaining_scenarios_count,
        COALESCE(
            (SELECT COUNT(DISTINCT ssl.scenario_id) FROM simulation_scenarios_list ssl
             LEFT JOIN scenarios_with_completed_chats swcc ON swcc.parent_scenario_id = ssl.scenario_id
             WHERE swcc.parent_scenario_id IS NULL),
            0
        ) = 1 as is_last_remaining_scenario,
        true as can_pick_multiple_alternatives  -- General attempts can always pick alternatives
)
SELECT
    aec.attempt_exists,
    ap.actor_name,
    COALESCE(rc.access_denied, false) as access_denied,
    (ac.attempt_id, ac.attempt_created_at, ac.simulation_id, ac.infinite_mode, ac.archived, cap.profile_id)::types.q_get_general_attempt_v4_attempt as attempt,
    (ac.simulation_id, ac.simulation_title, ac.simulation_description, ac.simulation_department_id, true, false, false,
     ac.hints_enabled, ac.objectives_enabled, ac.image_input_active, ac.copy_paste_allowed,
     ac.simulation_time_limit, ac.simulation_rubric_id, ac.attempt_created_at, ac.attempt_updated_at)::types.q_get_general_attempt_v4_simulation as simulation,
    COALESCE(apd.attempt_profiles, '{}'::types.q_get_general_attempt_v4_attempt_profile[]) as attempt_profiles,
    COALESCE(
        (SELECT ARRAY_AGG(cwad.chat_data ORDER BY cwad.position, cwad.created_at) FROM chats_with_all_data cwad),
        '{}'::types.q_get_general_attempt_v4_chat_data[]
    ) as chats_entry,
    COALESCE(sdd.scenario_documents_junction, '{}'::types.q_get_general_attempt_v4_scenario_document[]) as scenario_documents_junction,
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
            (asswpc.id, asswpc.scenario_name, asswpc.problem_statement, asswpc.scenario_department_id, true,
             asswpc.persona_id, asswpc.persona_name, asswpc.persona_icon, asswpc.persona_color,
             asswpc.created_at, asswpc.created_at, false, false, false, true, false, true, true, true, NULL::uuid,
             ARRAY[]::text[], asswpc.previous_chats)::types.q_get_general_attempt_v4_all_simulation_scenario
            ORDER BY asswpc.position
        ) FROM all_simulation_scenarios_with_previous_chats asswpc),
        '{}'::types.q_get_general_attempt_v4_all_simulation_scenario[]
    ) as all_simulation_scenarios,
    COALESCE(
        (SELECT (aco.next_sequential_options, aco.has_options)::types.q_get_general_attempt_v4_available_continuation_options FROM available_continuation_options aco),
        (ARRAY[]::types.q_get_general_attempt_v4_continuation_option[], false)::types.q_get_general_attempt_v4_available_continuation_options
    ) as available_continuation_options
FROM attempt_exists_check aec
CROSS JOIN attempt_context ac
CROSS JOIN attempt_profiles_data apd
CROSS JOIN actor_profile ap
CROSS JOIN current_attempt_profile cap
CROSS JOIN scenario_documents_data sdd
CROSS JOIN aggregated_results_data ard
CROSS JOIN timer_data td
CROSS JOIN metadata_computed md
LEFT JOIN rubric_structure_complete rsc ON true
LEFT JOIN role_check rc ON true;
$$;
