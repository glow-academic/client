-- ============================================================================
-- Query: get_attempt_overview_view
-- Purpose: Fetch simulation-level overview with mode-aware aggregation
-- Section: VIEWS/ATTEMPT/OVERVIEW
--
-- Supports both member and instructional modes:
-- - Member mode: Aggregates per simulation for current profile
-- - Instructional mode: Aggregates across all profiles with passed/in_progress/not_started counts
--
-- Returns: simulation cards, standard_groups, standards
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
        WHERE proname = 'api_get_attempt_overview_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_attempt_overview_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_attempt_overview_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

-- Simulation card with all metadata (matches home overview structure)
CREATE TYPE types.q_get_attempt_overview_view_v4_item AS (
    -- Core IDs
    simulation_id uuid,

    -- JOINed metadata
    simulation_name text,
    simulation_description text,
    time_limit int,
    department_ids text[],
    persona_color text,
    persona_icon text,
    cohort_names text[],
    standard_group_ids uuid[],

    -- Practice flag
    practice boolean,

    -- Metrics from aggregation
    attempt_count int,
    completed_count int,
    highest_score int,
    has_passed boolean,

    -- Rubric points (for computing pass_pct in Python)
    rubric_total_points int,
    rubric_pass_points int,

    -- Instructional mode counts (NULL for member mode)
    passed_count int,
    in_progress_count int,
    not_started_count int,
    total_members int
);

-- Standard group mapping (for sidebar/legend)
CREATE TYPE types.q_get_attempt_overview_view_v4_standard_group AS (
    standard_group_id uuid,
    name text,
    description text,
    points int,
    pass_points int
);

-- Standard mapping (for sidebar/legend)
CREATE TYPE types.q_get_attempt_overview_view_v4_standard AS (
    standard_id uuid,
    standard_group_id uuid,
    name text,
    description text,
    points int
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_attempt_overview_view_v4(
    start_date text DEFAULT NULL,
    end_date text DEFAULT NULL,
    profile_id_filter uuid DEFAULT NULL,
    simulation_ids uuid[] DEFAULT NULL,
    cohort_ids uuid[] DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    practice_filter boolean DEFAULT NULL
)
RETURNS TABLE (
    actor_name text,
    user_role text,
    has_data boolean,
    items types.q_get_attempt_overview_view_v4_item[],
    standard_groups types.q_get_attempt_overview_view_v4_standard_group[],
    standards types.q_get_attempt_overview_view_v4_standard[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        COALESCE(start_date::timestamptz, NOW() - INTERVAL '1 year') AS start_date,
        COALESCE(end_date::timestamptz, NOW() + INTERVAL '1 day') AS end_date,
        profile_id_filter AS profile_id,
        COALESCE(simulation_ids, ARRAY[]::uuid[]) AS simulation_ids,
        COALESCE(cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        practice_filter AS practice_filter
),

-- Get profile info from profiles_resource
profile_info AS (
    SELECT
        pr.id,
        pr.name,
        pr.role,
        pr.cohort_ids AS user_cohort_ids,
        pr.department_ids AS user_department_ids
    FROM profiles_resource pr, params p
    WHERE pr.id = p.profile_id
      AND pr.active = true
),

-- Determine mode based on role
mode_info AS (
    SELECT
        CASE
            WHEN pi.role = 'member' THEN 'member'
            ELSE 'instructional'
        END AS mode,
        pi.role = 'member' AS is_member_mode
    FROM profile_info pi
),

-- Get cohorts the profile has access to
accessible_cohorts AS (
    SELECT DISTINCT cr.id AS cohort_id, cr.name
    FROM profile_info pi
    CROSS JOIN LATERAL unnest(pi.user_cohort_ids) AS user_cohort_id
    JOIN cohorts_resource cr ON cr.id = user_cohort_id AND cr.active = true
    CROSS JOIN params p
    WHERE (cardinality(p.cohort_ids) = 0 OR cr.id = ANY(p.cohort_ids))
      AND (cardinality(p.department_ids) = 0 OR cardinality(cr.department_ids) = 0 OR cr.department_ids && p.department_ids)
),

-- Get simulations from those cohorts
cohort_simulations AS (
    SELECT DISTINCT
        cr.id AS cohort_id,
        unnest(cr.simulation_ids) AS simulation_id
    FROM cohorts_resource cr
    WHERE cr.id IN (SELECT cohort_id FROM accessible_cohorts)
      AND cr.active = true
),

-- MEMBER MODE: Get simulation status for current profile
member_sim_status AS (
    SELECT
        mh.simulation_id,
        COUNT(DISTINCT mh.attempt_id)::int AS attempt_count,
        COUNT(DISTINCT mh.attempt_id) FILTER (WHERE mh.num_chats_completed > 0)::int AS completed_count,
        MAX(mh.score_percent)::int AS highest_score,
        BOOL_OR(mh.has_passed) AS has_passed,
        MAX(mh.rubric_total_points) AS rubric_total_points,
        MAX(mh.rubric_pass_points) AS rubric_pass_points,
        ARRAY_AGG(DISTINCT pid) FILTER (WHERE pid IS NOT NULL) AS persona_ids,
        ARRAY_AGG(DISTINCT mh.cohort_id) FILTER (WHERE mh.cohort_id IS NOT NULL) AS cohort_ids,
        NULL::int AS passed_count,
        NULL::int AS in_progress_count,
        NULL::int AS not_started_count,
        NULL::int AS total_members
    FROM params p
    CROSS JOIN mode_info mi
    CROSS JOIN mv_simulation_history mh
    CROSS JOIN LATERAL unnest(mh.persona_ids) AS pid
    WHERE mi.is_member_mode
      AND (p.practice_filter IS NULL OR mh.practice = p.practice_filter)
      AND mh.profile_id = p.profile_id
      AND mh.attempt_created_at >= p.start_date
      AND mh.attempt_created_at < p.end_date
      AND mh.simulation_id IN (SELECT simulation_id FROM cohort_simulations)
      AND (cardinality(p.cohort_ids) = 0 OR mh.cohort_id = ANY(p.cohort_ids))
      AND (cardinality(p.department_ids) = 0 OR mh.department_id = ANY(p.department_ids))
    GROUP BY mh.simulation_id
),

-- INSTRUCTIONAL MODE: First get per-profile status, then aggregate
inst_profile_status AS (
    SELECT
        mh.simulation_id,
        mh.profile_id,
        BOOL_OR(mh.has_passed) AS profile_has_passed,
        SUM(mh.num_chats_completed) > 0 AS profile_has_completed,
        MAX(mh.score_percent) AS profile_highest_score,
        MAX(mh.rubric_total_points) AS rubric_total_points,
        MAX(mh.rubric_pass_points) AS rubric_pass_points,
        ARRAY_AGG(DISTINCT pid) FILTER (WHERE pid IS NOT NULL) AS persona_ids,
        ARRAY_AGG(DISTINCT mh.cohort_id) FILTER (WHERE mh.cohort_id IS NOT NULL) AS cohort_ids
    FROM params p
    CROSS JOIN mode_info mi
    CROSS JOIN mv_simulation_history mh
    LEFT JOIN LATERAL unnest(mh.persona_ids) AS pid ON true
    WHERE NOT mi.is_member_mode
      AND (p.practice_filter IS NULL OR mh.practice = p.practice_filter)
      AND mh.attempt_created_at >= p.start_date
      AND mh.attempt_created_at < p.end_date
      AND mh.simulation_id IN (SELECT simulation_id FROM cohort_simulations)
      AND (cardinality(p.cohort_ids) = 0 OR mh.cohort_id = ANY(p.cohort_ids))
      AND (cardinality(p.department_ids) = 0 OR mh.department_id = ANY(p.department_ids))
    GROUP BY mh.simulation_id, mh.profile_id
),

-- Aggregate persona_ids per simulation (instructional)
inst_persona_ids AS (
    SELECT
        simulation_id,
        ARRAY_AGG(DISTINCT pid) FILTER (WHERE pid IS NOT NULL) AS persona_ids
    FROM inst_profile_status
    CROSS JOIN LATERAL unnest(persona_ids) AS pid
    GROUP BY simulation_id
),

-- Aggregate cohort_ids per simulation (instructional)
inst_cohort_ids AS (
    SELECT
        simulation_id,
        ARRAY_AGG(DISTINCT cid) FILTER (WHERE cid IS NOT NULL) AS cohort_ids
    FROM inst_profile_status
    CROSS JOIN LATERAL unnest(cohort_ids) AS cid
    GROUP BY simulation_id
),

-- Aggregate profile statuses per simulation (instructional)
inst_sim_status AS (
    SELECT
        ips.simulation_id,
        COUNT(*)::int AS attempt_count,
        COUNT(*) FILTER (WHERE ips.profile_has_completed)::int AS completed_count,
        MAX(ips.profile_highest_score)::int AS highest_score,
        BOOL_OR(ips.profile_has_passed) AS has_passed,
        MAX(ips.rubric_total_points) AS rubric_total_points,
        MAX(ips.rubric_pass_points) AS rubric_pass_points,
        COALESCE(ipi.persona_ids, ARRAY[]::uuid[]) AS persona_ids,
        COALESCE(ici.cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
        COUNT(*) FILTER (WHERE ips.profile_has_passed)::int AS passed_count,
        COUNT(*) FILTER (WHERE NOT ips.profile_has_passed AND ips.profile_has_completed)::int AS in_progress_count,
        COUNT(*)::int AS total_members
    FROM inst_profile_status ips
    LEFT JOIN inst_persona_ids ipi ON ipi.simulation_id = ips.simulation_id
    LEFT JOIN inst_cohort_ids ici ON ici.simulation_id = ips.simulation_id
    GROUP BY ips.simulation_id, ipi.persona_ids, ici.cohort_ids
),

-- Combine member and instructional results
all_sim_status AS (
    SELECT * FROM member_sim_status
    UNION ALL
    SELECT
        simulation_id,
        attempt_count,
        completed_count,
        highest_score,
        has_passed,
        rubric_total_points,
        rubric_pass_points,
        persona_ids,
        cohort_ids,
        passed_count,
        in_progress_count,
        (total_members - passed_count - in_progress_count)::int AS not_started_count,
        total_members
    FROM inst_sim_status
),

-- Get scenario IDs for time limit and rubric
sim_scenarios AS (
    SELECT DISTINCT
        mh.simulation_id,
        sid AS scenario_id
    FROM mv_simulation_history mh, params p
    CROSS JOIN LATERAL unnest(mh.scenario_ids) AS sid
    WHERE (p.practice_filter IS NULL OR mh.practice = p.practice_filter)
      AND mh.simulation_id IN (SELECT simulation_id FROM all_sim_status)
),

-- Get time limits per simulation
sim_time_limits AS (
    SELECT
        ss.simulation_id,
        COALESCE(SUM(stlr.time_limit_seconds), 0)::int AS time_limit
    FROM sim_scenarios ss
    LEFT JOIN scenario_time_limits_resource stlr
        ON stlr.scenario_id = ss.scenario_id AND stlr.active = true
    GROUP BY ss.simulation_id
),

-- Get rubric info per simulation
sim_rubrics AS (
    SELECT DISTINCT ON (ss.simulation_id)
        ss.simulation_id,
        srr.rubric_id
    FROM sim_scenarios ss
    JOIN scenario_rubrics_resource srr
        ON srr.scenario_id = ss.scenario_id AND srr.active = true
    ORDER BY ss.simulation_id, srr.created_at
),

-- Get standard_group_ids per simulation from rubrics
sim_standard_groups AS (
    SELECT
        smr.simulation_id,
        ARRAY[]::uuid[] AS standard_group_ids
    FROM sim_rubrics smr
),

-- JOIN all metadata to simulation status
simulation_cards AS (
    SELECT
        ass.simulation_id,
        -- JOINed simulation metadata
        sr.name AS simulation_name,
        sr.description AS simulation_description,
        COALESCE(stl.time_limit, 0) AS time_limit,
        sr.department_ids::text[] AS department_ids,
        -- JOINed persona metadata (first persona)
        persona_meta.color AS persona_color,
        persona_meta.icon AS persona_icon,
        -- JOINed cohort names
        COALESCE(cohort_agg.names, ARRAY[]::text[]) AS cohort_names,
        -- JOINed standard_group_ids
        COALESCE(ssg.standard_group_ids, ARRAY[]::uuid[]) AS standard_group_ids,
        -- Practice filter value
        (SELECT practice_filter FROM params) AS practice,
        -- Metrics
        ass.attempt_count,
        ass.completed_count,
        ass.highest_score,
        ass.has_passed,
        ass.rubric_total_points,
        ass.rubric_pass_points,
        ass.passed_count,
        ass.in_progress_count,
        ass.not_started_count,
        ass.total_members
    FROM all_sim_status ass
    JOIN simulations_resource sr ON sr.id = ass.simulation_id AND sr.active = true
    LEFT JOIN sim_time_limits stl ON stl.simulation_id = ass.simulation_id
    LEFT JOIN sim_standard_groups ssg ON ssg.simulation_id = ass.simulation_id
    -- Get first persona's color/icon
    LEFT JOIN LATERAL (
        SELECT pr.color, pr.icon
        FROM unnest(ass.persona_ids) WITH ORDINALITY AS u(pid, ord)
        JOIN personas_resource pr ON pr.id = pid AND pr.active = true
        ORDER BY ord
        LIMIT 1
    ) persona_meta ON true
    -- Aggregate cohort names
    LEFT JOIN LATERAL (
        SELECT ARRAY_AGG(cr.name ORDER BY cr.name) AS names
        FROM unnest(ass.cohort_ids) AS cid
        JOIN cohorts_resource cr ON cr.id = cid AND cr.active = true
    ) cohort_agg ON true
),

-- Get all standard_group_ids for standard_groups/standards mappings
all_standard_group_ids AS (
    SELECT DISTINCT unnest(standard_group_ids) AS standard_group_id
    FROM sim_standard_groups
),

-- Standard groups mapping (for sidebar/legend)
standard_groups_meta AS (
    SELECT
        (sg.id, sg.name, sg.description, sg.points, sg.pass_points)::types.q_get_attempt_overview_view_v4_standard_group AS standard_group
    FROM all_standard_group_ids asgi
    JOIN standard_groups_resource sg ON sg.id = asgi.standard_group_id AND sg.active = true
),

-- Standards mapping (for sidebar/legend)
standards_meta AS (
    SELECT
        (st.id, st.standard_group_id, st.name, st.description, st.points)::types.q_get_attempt_overview_view_v4_standard AS standard
    FROM standards_resource st
    WHERE st.standard_group_id IN (SELECT standard_group_id FROM all_standard_group_ids)
      AND st.active = true
),

-- Aggregate simulation cards
simulation_cards_agg AS (
    SELECT COALESCE(ARRAY_AGG(
        (simulation_id, simulation_name, simulation_description, time_limit, department_ids,
         persona_color, persona_icon, cohort_names, standard_group_ids, practice,
         attempt_count, completed_count, highest_score, has_passed,
         rubric_total_points, rubric_pass_points,
         passed_count, in_progress_count, not_started_count, total_members
        )::types.q_get_attempt_overview_view_v4_item
        ORDER BY simulation_name
    ), ARRAY[]::types.q_get_attempt_overview_view_v4_item[]) AS cards
    FROM simulation_cards
),

-- Aggregate standard groups
standard_groups_agg AS (
    SELECT COALESCE(ARRAY_AGG(standard_group), ARRAY[]::types.q_get_attempt_overview_view_v4_standard_group[]) AS standard_groups
    FROM standard_groups_meta
),

-- Aggregate standards
standards_agg AS (
    SELECT COALESCE(ARRAY_AGG(standard), ARRAY[]::types.q_get_attempt_overview_view_v4_standard[]) AS standards
    FROM standards_meta
)

SELECT
    COALESCE(pi.name, 'System')::text AS actor_name,
    COALESCE(pi.role, 'member')::text AS user_role,
    (SELECT COUNT(*) > 0 FROM all_sim_status)::boolean AS has_data,
    (SELECT cards FROM simulation_cards_agg) AS items,
    (SELECT standard_groups FROM standard_groups_agg) AS standard_groups,
    (SELECT standards FROM standards_agg) AS standards
FROM profile_info pi;
$$;
