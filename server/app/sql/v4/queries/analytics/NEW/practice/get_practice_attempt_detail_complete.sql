-- Get practice attempt detail using three-MV architecture
-- Three queries for parallel execution:
-- 1. api_get_practice_attempt_new_v4 - Attempt-level data + resource joins
-- 2. api_get_practice_attempt_chats_new_v4 - Chat-level data + resource joins
-- 3. api_get_practice_attempt_messages_new_v4 - Message-level data with hints (PRACTICE-specific)
--
-- Dependencies: mv_practice_attempts, mv_practice_chats, mv_practice_messages

-- ============================================================================
-- Drop existing functions
-- ============================================================================

DO $$
DECLARE
    r RECORD;
    func_names text[] := ARRAY[
        'api_get_practice_attempt_new_v4',
        'api_get_practice_attempt_chats_new_v4',
        'api_get_practice_attempt_messages_new_v4'
    ];
    func_name text;
BEGIN
    FOREACH func_name IN ARRAY func_names
    LOOP
        FOR r IN
            SELECT oidvectortypes(proargtypes) as sig
            FROM pg_proc
            WHERE proname = func_name
              AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        LOOP
            EXECUTE format('DROP FUNCTION IF EXISTS %I(%s)', func_name, r.sig);
        END LOOP;
    END LOOP;
END $$;

-- ============================================================================
-- Query 1: Attempt data + resource joins
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_practice_attempt_new_v4(
    attempt_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    -- Permission check
    attempt_exists boolean,
    access_denied boolean,
    actor_name text,

    -- Attempt data (from MV)
    out_attempt_id uuid,
    attempt_created_at timestamptz,
    infinite_mode boolean,
    is_archived boolean,
    total_chats int,
    completed_chats int,
    total_score float,
    all_passed boolean,
    elapsed_seconds int,
    rubric_total_points int,
    rubric_pass_points int,
    scenario_ids uuid[],
    persona_ids uuid[],

    -- Resource IDs
    simulation_id uuid,
    profile_id_out uuid,
    department_id uuid,

    -- Simulation resource data (JOINed)
    simulation_name text,
    simulation_description text,
    time_limit int,
    hints_enabled boolean,
    objectives_enabled boolean,
    image_input_active boolean,
    copy_paste_allowed boolean,

    -- Profile resource data (JOINed)
    profile_name text
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        attempt_id AS attempt_id,
        profile_id AS profile_id
),
-- Check if attempt exists
attempt_exists_check AS (
    SELECT EXISTS(
        SELECT 1 FROM mv_practice_attempts WHERE attempt_id = (SELECT attempt_id FROM params)
    )::boolean as attempt_exists
),
-- Get actor profile name
actor_profile AS (
    SELECT pr.name AS actor_name
    FROM profiles_resource pr
    CROSS JOIN params p
    WHERE pr.id = p.profile_id
),
-- Get attempt from MV
attempt_data AS (
    SELECT a.*
    FROM mv_practice_attempts a
    CROSS JOIN params p
    WHERE a.attempt_id = p.attempt_id
),
-- Role-based access control
access_check AS (
    SELECT
        CASE
            WHEN ad.profile_id = p.profile_id THEN false  -- Own attempt
            WHEN pr.role IN ('admin', 'superadmin', 'instructional') THEN false  -- Admin/instructional can view
            ELSE true  -- Member cannot view others' attempts
        END AS access_denied
    FROM params p
    LEFT JOIN attempt_data ad ON true
    LEFT JOIN profiles_resource pr ON pr.id = p.profile_id
),
-- Get simulation metadata from simulations_resource
simulation_metadata AS (
    SELECT
        sr.id AS simulation_id,
        sr.name AS simulation_name,
        sr.description AS simulation_description
    FROM attempt_data ad
    JOIN simulations_resource sr ON sr.id = ad.simulation_id
),
-- Get simulation flags
simulation_flags AS (
    SELECT
        ad.simulation_id,
        COALESCE((SELECT sf.value FROM simulation_flags_junction sf
            JOIN flags_resource f ON f.id = sf.flag_id
            WHERE sf.simulation_id = ad.simulation_id AND f.name = 'hints_enabled'
            LIMIT 1), false) AS hints_enabled,
        COALESCE((SELECT sf.value FROM simulation_flags_junction sf
            JOIN flags_resource f ON f.id = sf.flag_id
            WHERE sf.simulation_id = ad.simulation_id AND f.name = 'objectives_enabled'
            LIMIT 1), true) AS objectives_enabled,
        COALESCE((SELECT sf.value FROM simulation_flags_junction sf
            JOIN flags_resource f ON f.id = sf.flag_id
            WHERE sf.simulation_id = ad.simulation_id AND f.name = 'image_input_active'
            LIMIT 1), false) AS image_input_active,
        COALESCE((SELECT sf.value FROM simulation_flags_junction sf
            JOIN flags_resource f ON f.id = sf.flag_id
            WHERE sf.simulation_id = ad.simulation_id AND f.name = 'copy_paste_allowed'
            LIMIT 1), true) AS copy_paste_allowed
    FROM attempt_data ad
),
-- Get simulation time limit (computed from scenario time limits)
simulation_time_limit AS (
    SELECT
        COALESCE((SELECT (SUM(stlr.time_limit_seconds) / 60)::int
            FROM simulation_scenario_time_limits_junction sstl
            JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id
            JOIN simulation_scenarios_junction ss ON ss.simulation_id = sstl.simulation_id AND ss.scenario_id = stlr.scenario_id
            WHERE sstl.simulation_id = ad.simulation_id
              AND sstl.active = true
              AND stlr.active = true
              AND EXISTS (
                  SELECT 1 FROM simulation_scenario_flags_junction ssf
                  JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id
                  JOIN flags_resource f ON sfr.flag_id = f.id
                  WHERE ssf.simulation_id = ss.simulation_id
                    AND sfr.scenario_id = ss.scenario_id
                    AND f.name = 'simulation_active'
                    AND ssf.value = true
              )), 0) AS time_limit
    FROM attempt_data ad
)
SELECT
    (SELECT attempt_exists FROM attempt_exists_check),
    COALESCE((SELECT access_denied FROM access_check), true),
    (SELECT actor_name FROM actor_profile),

    -- Attempt data
    ad.attempt_id,
    ad.attempt_created_at,
    ad.infinite_mode,
    ad.is_archived,  -- PRACTICE-specific
    ad.total_chats,
    ad.completed_chats,
    ad.total_score,
    ad.all_passed,
    ad.elapsed_seconds,
    ad.rubric_total_points,
    ad.rubric_pass_points,
    ad.scenario_ids,
    ad.persona_ids,

    -- Resource IDs (no cohort_id for practice)
    ad.simulation_id,
    ad.profile_id,
    ad.department_id,

    -- Simulation resource (JOINed)
    sm.simulation_name,
    sm.simulation_description,
    stl.time_limit,
    sf.hints_enabled,
    sf.objectives_enabled,
    sf.image_input_active,
    sf.copy_paste_allowed,

    -- Profile resource (JOINed)
    pr.name AS profile_name

FROM attempt_data ad
LEFT JOIN simulation_metadata sm ON sm.simulation_id = ad.simulation_id
LEFT JOIN simulation_flags sf ON sf.simulation_id = ad.simulation_id
LEFT JOIN simulation_time_limit stl ON true
LEFT JOIN profiles_resource pr ON pr.id = ad.profile_id
$$;

-- ============================================================================
-- Query 2: Chats data + resource joins
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_practice_attempt_chats_new_v4(
    attempt_id uuid
)
RETURNS TABLE (
    -- Chat data (from MV)
    chat_id uuid,
    out_attempt_id uuid,
    chat_created_at timestamptz,
    chat_completed boolean,
    chat_position int,
    is_current_chat boolean,

    -- Grade data
    grade_id uuid,
    grade_score int,
    grade_passed boolean,
    grade_description text,
    grade_time_taken int,
    rubric_total_points int,
    rubric_pass_points int,

    -- Feedbacks array (denormalized)
    feedbacks types.mv_feedback[],

    -- Resource IDs
    scenario_id uuid,
    persona_id uuid,
    rubric_id uuid,

    -- Scenario resource data (JOINed)
    scenario_name text,
    problem_statement text,
    show_problem_statement boolean,
    show_objectives boolean,
    objectives text[],

    -- Persona resource data (JOINed)
    persona_name text,
    persona_icon text,
    persona_color text
)
LANGUAGE sql
STABLE
AS $$
SELECT
    -- Chat data
    c.chat_id,
    c.attempt_id,
    c.chat_created_at,
    c.chat_completed,
    c.chat_position,
    c.is_current_chat,

    -- Grade data
    c.grade_id,
    c.grade_score,
    c.grade_passed,
    c.grade_description,
    c.grade_time_taken,
    c.rubric_total_points,
    c.rubric_pass_points,

    -- Feedbacks
    c.feedbacks,

    -- Resource IDs
    c.scenario_id,
    c.persona_id,
    c.rubric_id,

    -- Scenario resource (JOINed)
    (SELECT n.name FROM scenario_names_junction snj
        JOIN names_resource n ON n.id = snj.name_id
        WHERE snj.scenario_id = c.scenario_id AND snj.active = true LIMIT 1) AS scenario_name,
    (SELECT ps.problem_statement FROM scenario_problem_statements_junction spsj
        JOIN problem_statements_resource ps ON ps.id = spsj.problem_statement_id
        WHERE spsj.scenario_id = c.scenario_id AND spsj.active = true LIMIT 1) AS problem_statement,
    COALESCE((SELECT sf.value FROM scenario_flags_junction sf
        JOIN flags_resource f ON f.id = sf.flag_id
        WHERE sf.scenario_id = c.scenario_id AND f.name = 'show_problem_statement' LIMIT 1), true) AS show_problem_statement,
    COALESCE((SELECT sf.value FROM scenario_flags_junction sf
        JOIN flags_resource f ON f.id = sf.flag_id
        WHERE sf.scenario_id = c.scenario_id AND f.name = 'show_objectives' LIMIT 1), true) AS show_objectives,
    (SELECT ARRAY_AGG(o.objective ORDER BY soj.idx)
        FROM scenario_objectives_junction soj
        JOIN objectives_resource o ON o.id = soj.objective_id
        WHERE soj.scenario_id = c.scenario_id AND soj.active = true) AS objectives,

    -- Persona resource (JOINed)
    (SELECT n.name FROM persona_names_junction pnj
        JOIN names_resource n ON n.id = pnj.name_id
        WHERE pnj.persona_id = c.persona_id LIMIT 1) AS persona_name,
    (SELECT i.value FROM persona_icons_junction pij
        JOIN icons_resource i ON i.id = pij.icon_id
        WHERE pij.persona_id = c.persona_id LIMIT 1) AS persona_icon,
    (SELECT col.hex_code FROM persona_colors_junction pcj
        JOIN colors_resource col ON col.id = pcj.color_id
        WHERE pcj.persona_id = c.persona_id LIMIT 1) AS persona_color

FROM mv_practice_chats c
WHERE c.attempt_id = attempt_id
ORDER BY c.chat_position
$$;

-- ============================================================================
-- Query 3: Messages data with hints (PRACTICE-specific)
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_practice_attempt_messages_new_v4(
    attempt_id uuid
)
RETURNS TABLE (
    -- Message data (from MV)
    message_id uuid,
    chat_id uuid,
    out_attempt_id uuid,
    content text,
    type text,
    created_at timestamptz,
    completed boolean,
    message_position int,

    -- Hints (PRACTICE-specific, denormalized in MV)
    hints types.mv_hint[],

    -- Strengths with highlights (denormalized in MV)
    strengths types.mv_strength[],

    -- Improvements with replacements (denormalized in MV)
    improvements types.mv_improvement[]
)
LANGUAGE sql
STABLE
AS $$
SELECT
    m.message_id,
    m.chat_id,
    m.attempt_id,
    m.content,
    m.type,
    m.created_at,
    m.completed,
    m.message_position,
    m.hints,  -- PRACTICE-specific
    m.strengths,
    m.improvements
FROM mv_practice_messages m
WHERE m.attempt_id = attempt_id
ORDER BY m.chat_id, m.message_position
$$;
