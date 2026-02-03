-- Get NEW home overview with simulation cards
-- REFACTORED: All JOINs done in SQL, only business logic in Python
--
-- SQL handles:
--   - Aggregation by simulation
--   - JOINs to _resource tables for names, colors, etc.
--   - Mode determination
--
-- Python handles (business logic only):
--   - status (passed/in-progress/not-started)
--   - pass_pct / pass_rate (calculation from rubric points)
--   - completion_pct (for instructional mode)
--   - cohort_names_junction (formatting "A, B, and C")

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_home_overview_new_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_home_overview_new_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_home_overview_new_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
-- Simulation card with all metadata JOINed (Python only computes derived fields)
CREATE TYPE types.q_get_home_overview_new_v4_simulation_card AS (
    -- Core IDs
    simulation_id uuid,
    -- JOINed metadata (no Python lookups needed)
    simulation_name text,
    simulation_description text,
    time_limit int,
    department_ids text[],
    persona_color text,
    persona_icon text,
    cohort_names text[],
    standard_group_ids uuid[],
    -- Metrics from MV aggregation
    attempt_count int,
    completed_count int,
    highest_score int,
    has_passed boolean,
    -- Raw data for Python business logic
    rubric_total_points int,
    rubric_pass_points int,
    -- Instructional mode counts (NULL for member mode)
    passed_count int,
    in_progress_count int,
    not_started_count int,
    total_members int
);

-- Standard group mapping (for sidebar/legend)
CREATE TYPE types.q_get_home_overview_new_v4_standard_group AS (
    standard_group_id uuid,
    name text,
    description text,
    points int,
    pass_points int
);

-- Standard mapping (for sidebar/legend)
CREATE TYPE types.q_get_home_overview_new_v4_standard AS (
    standard_id uuid,
    standard_group_id uuid,
    name text,
    description text,
    points int
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_home_overview_new_v4(
    start_date text,
    end_date text,
    profile_id uuid,
    cohort_ids uuid[] DEFAULT ARRAY[]::uuid[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    actor_name text,
    mode text,
    has_data boolean,
    -- Simulation cards with metadata already JOINed
    simulation_cards types.q_get_home_overview_new_v4_simulation_card[],
    -- Standard mappings (for sidebar/legend, not per-simulation)
    standard_groups types.q_get_home_overview_new_v4_standard_group[],
    standards types.q_get_home_overview_new_v4_standard[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        start_date::timestamptz AS start_date,
        end_date::timestamptz AS end_date,
        profile_id AS profile_id,
        COALESCE(cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids
),

-- Get profile info from profiles_resource
profile_info AS (
    SELECT
        pr.id,
        pr.name,
        pr.role,
        pr.cohort_ids AS user_cohort_ids,
        pr.department_ids AS user_department_ids
    FROM profiles_resource pr
    WHERE pr.id = (SELECT profile_id FROM params)
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

-- Get cohorts the profile has access to (for instructional mode)
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
        mah.simulation_id,
        COUNT(DISTINCT mah.attempt_id)::int AS attempt_count,
        COUNT(DISTINCT mah.attempt_id) FILTER (WHERE mah.num_chats_completed > 0)::int AS completed_count,
        MAX(mah.score_percent)::int AS highest_score,
        BOOL_OR(mah.has_passed) AS has_passed,
        MAX(mah.rubric_total_points) AS rubric_total_points,
        MAX(mah.rubric_pass_points) AS rubric_pass_points,
        ARRAY_AGG(DISTINCT pid) FILTER (WHERE pid IS NOT NULL) AS persona_ids,
        ARRAY_AGG(DISTINCT mah.cohort_id) FILTER (WHERE mah.cohort_id IS NOT NULL) AS cohort_ids,
        NULL::int AS passed_count,
        NULL::int AS in_progress_count,
        NULL::int AS not_started_count,
        NULL::int AS total_members
    FROM params p
    CROSS JOIN mode_info mi
    CROSS JOIN mv_simulation_history mah
    CROSS JOIN LATERAL unnest(mah.persona_ids) AS pid
    WHERE mah.practice = FALSE  -- Home uses non-practice attempts
      AND mi.is_member_mode
      AND mah.profile_id = p.profile_id
      AND mah.attempt_created_at >= p.start_date
      AND mah.attempt_created_at < p.end_date
      AND mah.simulation_id IN (SELECT simulation_id FROM cohort_simulations)
      AND (cardinality(p.cohort_ids) = 0 OR mah.cohort_id = ANY(p.cohort_ids))
      AND (cardinality(p.department_ids) = 0 OR mah.department_id = ANY(p.department_ids))
    GROUP BY mah.simulation_id
),

-- INSTRUCTIONAL MODE: First get per-profile status, then aggregate
inst_profile_status AS (
    SELECT
        mah.simulation_id,
        mah.profile_id,
        BOOL_OR(mah.has_passed) AS profile_has_passed,
        SUM(mah.num_chats_completed) > 0 AS profile_has_completed,
        MAX(mah.score_percent) AS profile_highest_score,
        MAX(mah.rubric_total_points) AS rubric_total_points,
        MAX(mah.rubric_pass_points) AS rubric_pass_points,
        ARRAY_AGG(DISTINCT pid) FILTER (WHERE pid IS NOT NULL) AS persona_ids,
        ARRAY_AGG(DISTINCT mah.cohort_id) FILTER (WHERE mah.cohort_id IS NOT NULL) AS cohort_ids
    FROM params p
    CROSS JOIN mode_info mi
    CROSS JOIN mv_simulation_history mah
    LEFT JOIN LATERAL unnest(mah.persona_ids) AS pid ON true
    WHERE mah.practice = FALSE  -- Home uses non-practice attempts
      AND NOT mi.is_member_mode
      AND mah.attempt_created_at >= p.start_date
      AND mah.attempt_created_at < p.end_date
      AND mah.simulation_id IN (SELECT simulation_id FROM cohort_simulations)
      AND (cardinality(p.cohort_ids) = 0 OR mah.cohort_id = ANY(p.cohort_ids))
      AND (cardinality(p.department_ids) = 0 OR mah.department_id = ANY(p.department_ids))
    GROUP BY mah.simulation_id, mah.profile_id
),

-- Aggregate persona_ids per simulation
inst_persona_ids AS (
    SELECT
        simulation_id,
        ARRAY_AGG(DISTINCT pid) FILTER (WHERE pid IS NOT NULL) AS persona_ids
    FROM inst_profile_status
    CROSS JOIN LATERAL unnest(persona_ids) AS pid
    GROUP BY simulation_id
),

-- Aggregate cohort_ids per simulation
inst_cohort_ids AS (
    SELECT
        simulation_id,
        ARRAY_AGG(DISTINCT cid) FILTER (WHERE cid IS NOT NULL) AS cohort_ids
    FROM inst_profile_status
    CROSS JOIN LATERAL unnest(cohort_ids) AS cid
    GROUP BY simulation_id
),

-- Aggregate profile statuses per simulation
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
        mah.simulation_id,
        sid AS scenario_id
    FROM mv_simulation_history mah
    CROSS JOIN LATERAL unnest(mah.scenario_ids) AS sid
    WHERE mah.practice = FALSE  -- Home uses non-practice attempts
      AND mah.simulation_id IN (SELECT simulation_id FROM all_sim_status)
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

-- Get standard_group_ids per simulation from rubrics (via junction table)
sim_standard_groups AS (
    SELECT
        smr.simulation_id,
        ARRAY_AGG(DISTINCT rsgj.standard_group_id ORDER BY rsgj.standard_group_id) AS standard_group_ids
    FROM sim_rubrics smr
    JOIN rubric_rubrics_junction rrj ON rrj.rubrics_id = smr.rubric_id AND rrj.active = true
    JOIN rubric_standard_groups_junction rsgj ON rsgj.rubric_id = rrj.rubric_id AND rsgj.active = true
    GROUP BY smr.simulation_id
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
        (sg.id, sg.name, sg.description, sg.points, sg.pass_points)::types.q_get_home_overview_new_v4_standard_group AS standard_group
    FROM all_standard_group_ids asgi
    JOIN standard_groups_resource sg ON sg.id = asgi.standard_group_id AND sg.active = true
),

-- Standards mapping (for sidebar/legend)
standards_meta AS (
    SELECT
        (st.id, st.standard_group_id, st.name, st.description, st.points)::types.q_get_home_overview_new_v4_standard AS standard
    FROM standards_resource st
    WHERE st.standard_group_id IN (SELECT standard_group_id FROM all_standard_group_ids)
      AND st.active = true
),

-- Aggregate simulation cards
simulation_cards_agg AS (
    SELECT COALESCE(ARRAY_AGG(
        (simulation_id, simulation_name, simulation_description, time_limit, department_ids,
         persona_color, persona_icon, cohort_names, standard_group_ids,
         attempt_count, completed_count, highest_score, has_passed,
         rubric_total_points, rubric_pass_points,
         passed_count, in_progress_count, not_started_count, total_members
        )::types.q_get_home_overview_new_v4_simulation_card
    ), ARRAY[]::types.q_get_home_overview_new_v4_simulation_card[]) AS cards
    FROM simulation_cards
),

-- Aggregate standard groups
standard_groups_agg AS (
    SELECT COALESCE(ARRAY_AGG(standard_group), ARRAY[]::types.q_get_home_overview_new_v4_standard_group[]) AS standard_groups
    FROM standard_groups_meta
),

-- Aggregate standards
standards_agg AS (
    SELECT COALESCE(ARRAY_AGG(standard), ARRAY[]::types.q_get_home_overview_new_v4_standard[]) AS standards
    FROM standards_meta
)

SELECT
    COALESCE(pi.name, 'System')::text AS actor_name,
    COALESCE(mi.mode, 'instructional')::text AS mode,
    (SELECT COUNT(*) > 0 FROM all_sim_status)::boolean AS has_data,
    (SELECT cards FROM simulation_cards_agg) AS simulation_cards,
    (SELECT standard_groups FROM standard_groups_agg) AS standard_groups,
    (SELECT standards FROM standards_agg) AS standards
FROM profile_info pi
CROSS JOIN mode_info mi
$$;
