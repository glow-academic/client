-- Get NEW practice overview with simulation cards
-- REFACTORED: All JOINs done in SQL, only business logic in Python
--
-- SQL handles:
--   - Aggregating from mv_practice_attempt_history (like HOME)
--   - JOINs to _resource tables for names, colors, etc.
--
-- Python handles (business logic only):
--   - status (passed/in-progress/not-started)
--   - pass_pct (calculation from rubric points)
--   - cohort_names_junction (formatting "A, B, and C")

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_practice_overview_new_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_practice_overview_new_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_practice_overview_new_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
-- Simulation card with all metadata JOINed (Python only computes derived fields)
CREATE TYPE types.q_get_practice_overview_new_v4_simulation_card AS (
    -- Core IDs
    simulation_id uuid,
    -- JOINed metadata (no Python lookups needed)
    simulation_name text,
    simulation_description text,
    time_limit int,
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
    -- Practice-specific
    practice_simulation boolean,
    practice_scenario_id uuid
);

-- Standard group mapping (for sidebar/legend)
CREATE TYPE types.q_get_practice_overview_new_v4_standard_group AS (
    standard_group_id uuid,
    name text,
    description text,
    points int,
    pass_points int
);

-- Standard mapping (for sidebar/legend)
CREATE TYPE types.q_get_practice_overview_new_v4_standard AS (
    standard_id uuid,
    standard_group_id uuid,
    name text,
    description text,
    points int
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_practice_overview_new_v4(
    profile_id uuid,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    actor_name text,
    has_data boolean,
    -- Simulation cards with metadata already JOINed
    simulation_cards types.q_get_practice_overview_new_v4_simulation_card[],
    -- Standard mappings (for sidebar/legend, not per-simulation)
    standard_groups types.q_get_practice_overview_new_v4_standard_group[],
    standards types.q_get_practice_overview_new_v4_standard[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id,
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

-- Get simulations from user's cohorts
cohort_simulations AS (
    SELECT DISTINCT
        cr.id AS cohort_id,
        cr.name AS cohort_name,
        unnest(cr.simulation_ids) AS simulation_id
    FROM profile_info pi
    CROSS JOIN LATERAL unnest(pi.user_cohort_ids) AS user_cohort_id
    JOIN cohorts_resource cr ON cr.id = user_cohort_id AND cr.active = true
    CROSS JOIN params p
    WHERE (cardinality(p.department_ids) = 0 OR cardinality(cr.department_ids) = 0 OR cr.department_ids && p.department_ids)
),

-- Aggregate practice simulation status from mv_practice_attempt_history (like HOME)
-- This gives us persona_ids and scenario_ids from the MV
practice_sim_status AS (
    SELECT
        mpah.simulation_id,
        COUNT(DISTINCT mpah.attempt_id)::int AS attempt_count,
        COUNT(DISTINCT mpah.attempt_id) FILTER (WHERE mpah.num_chats_completed > 0)::int AS completed_count,
        MAX(mpah.score_percent)::int AS highest_score,
        BOOL_OR(mpah.has_passed) AS has_passed,
        MAX(mpah.rubric_total_points) AS rubric_total_points,
        MAX(mpah.rubric_pass_points) AS rubric_pass_points,
        ARRAY_AGG(DISTINCT pid) FILTER (WHERE pid IS NOT NULL) AS persona_ids,
        ARRAY_AGG(DISTINCT mpah.cohort_id) FILTER (WHERE mpah.cohort_id IS NOT NULL) AS cohort_ids,
        ARRAY_AGG(DISTINCT sid) FILTER (WHERE sid IS NOT NULL) AS scenario_ids
    FROM params p
    CROSS JOIN mv_practice_attempt_history mpah
    CROSS JOIN LATERAL unnest(mpah.persona_ids) AS pid
    CROSS JOIN LATERAL unnest(mpah.scenario_ids) AS sid
    WHERE mpah.profile_id = p.profile_id
      AND mpah.is_archived = FALSE
      AND mpah.simulation_id IN (SELECT simulation_id FROM cohort_simulations)
      AND (cardinality(p.department_ids) = 0 OR mpah.department_id = ANY(p.department_ids))
    GROUP BY mpah.simulation_id
),

-- Get all simulations from cohorts (including ones not started)
all_sim_status AS (
    SELECT DISTINCT
        cs.simulation_id,
        COALESCE(pss.attempt_count, 0) AS attempt_count,
        COALESCE(pss.completed_count, 0) AS completed_count,
        pss.highest_score,
        COALESCE(pss.has_passed, FALSE) AS has_passed,
        pss.rubric_total_points,
        pss.rubric_pass_points,
        COALESCE(pss.persona_ids, ARRAY[]::uuid[]) AS persona_ids,
        COALESCE(pss.cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
        COALESCE(pss.scenario_ids, ARRAY[]::uuid[]) AS scenario_ids
    FROM cohort_simulations cs
    LEFT JOIN practice_sim_status pss ON pss.simulation_id = cs.simulation_id
),

-- Get time limits per simulation from scenario_ids
sim_time_limits AS (
    SELECT
        ass.simulation_id,
        COALESCE(SUM(stlr.time_limit_seconds), 0)::int AS time_limit
    FROM all_sim_status ass
    CROSS JOIN LATERAL unnest(ass.scenario_ids) AS sid
    LEFT JOIN scenario_time_limits_resource stlr
        ON stlr.scenario_id = sid AND stlr.active = true
    GROUP BY ass.simulation_id
),

-- Get rubric info per simulation from scenario_ids
sim_rubrics AS (
    SELECT DISTINCT ON (ass.simulation_id)
        ass.simulation_id,
        srr.rubric_id
    FROM all_sim_status ass
    CROSS JOIN LATERAL unnest(ass.scenario_ids) AS sid
    JOIN scenario_rubrics_resource srr
        ON srr.scenario_id = sid AND srr.active = true
    ORDER BY ass.simulation_id, srr.created_at
),

-- Get standard_group_ids per simulation from rubrics
sim_standard_groups AS (
    SELECT
        smr.simulation_id,
        rr.standard_group_ids
    FROM sim_rubrics smr
    JOIN rubrics_resource rr ON rr.id = smr.rubric_id AND rr.active = true
),

-- Get cohort names per simulation
sim_cohort_names AS (
    SELECT
        cs.simulation_id,
        ARRAY_AGG(DISTINCT cs.cohort_name ORDER BY cs.cohort_name) AS cohort_names
    FROM cohort_simulations cs
    GROUP BY cs.simulation_id
),

-- JOIN all metadata to simulation status
simulation_cards AS (
    SELECT
        ass.simulation_id,
        -- JOINed simulation metadata
        sr.name AS simulation_name,
        sr.description AS simulation_description,
        COALESCE(stl.time_limit, 0) AS time_limit,
        -- JOINed persona metadata (first persona)
        persona_meta.color AS persona_color,
        persona_meta.icon AS persona_icon,
        -- JOINed cohort names
        COALESCE(scn.cohort_names, ARRAY[]::text[]) AS cohort_names,
        -- JOINed standard_group_ids
        COALESCE(ssg.standard_group_ids, ARRAY[]::uuid[]) AS standard_group_ids,
        -- Metrics
        ass.attempt_count,
        ass.completed_count,
        ass.highest_score,
        ass.has_passed,
        ass.rubric_total_points,
        ass.rubric_pass_points,
        -- Practice-specific
        TRUE AS practice_simulation,
        ass.scenario_ids[1] AS practice_scenario_id
    FROM all_sim_status ass
    JOIN simulations_resource sr ON sr.id = ass.simulation_id AND sr.active = true
    LEFT JOIN sim_time_limits stl ON stl.simulation_id = ass.simulation_id
    LEFT JOIN sim_standard_groups ssg ON ssg.simulation_id = ass.simulation_id
    LEFT JOIN sim_cohort_names scn ON scn.simulation_id = ass.simulation_id
    -- Get first persona's color/icon
    LEFT JOIN LATERAL (
        SELECT pr.color, pr.icon
        FROM unnest(ass.persona_ids) WITH ORDINALITY AS u(pid, ord)
        JOIN personas_resource pr ON pr.id = pid AND pr.active = true
        ORDER BY ord
        LIMIT 1
    ) persona_meta ON true
),

-- Get all standard_group_ids for standard_groups/standards mappings
all_standard_group_ids AS (
    SELECT DISTINCT unnest(standard_group_ids) AS standard_group_id
    FROM sim_standard_groups
),

-- Standard groups mapping (for sidebar/legend)
standard_groups_meta AS (
    SELECT
        (sg.id, sg.name, sg.description, sg.points, sg.pass_points)::types.q_get_practice_overview_new_v4_standard_group AS standard_group
    FROM all_standard_group_ids asgi
    JOIN standard_groups_resource sg ON sg.id = asgi.standard_group_id AND sg.active = true
),

-- Standards mapping (for sidebar/legend)
standards_meta AS (
    SELECT
        (st.id, st.standard_group_id, st.name, st.description, st.points)::types.q_get_practice_overview_new_v4_standard AS standard
    FROM standards_resource st
    WHERE st.standard_group_id IN (SELECT standard_group_id FROM all_standard_group_ids)
      AND st.active = true
),

-- Aggregate simulation cards
simulation_cards_agg AS (
    SELECT COALESCE(ARRAY_AGG(
        (simulation_id, simulation_name, simulation_description, time_limit,
         persona_color, persona_icon, cohort_names, standard_group_ids,
         attempt_count, completed_count, highest_score, has_passed,
         rubric_total_points, rubric_pass_points,
         practice_simulation, practice_scenario_id
        )::types.q_get_practice_overview_new_v4_simulation_card
    ), ARRAY[]::types.q_get_practice_overview_new_v4_simulation_card[]) AS cards
    FROM simulation_cards
),

-- Aggregate standard groups
standard_groups_agg AS (
    SELECT COALESCE(ARRAY_AGG(standard_group), ARRAY[]::types.q_get_practice_overview_new_v4_standard_group[]) AS standard_groups
    FROM standard_groups_meta
),

-- Aggregate standards
standards_agg AS (
    SELECT COALESCE(ARRAY_AGG(standard), ARRAY[]::types.q_get_practice_overview_new_v4_standard[]) AS standards
    FROM standards_meta
)

SELECT
    COALESCE(pi.name, 'System')::text AS actor_name,
    (SELECT COUNT(*) > 0 FROM simulation_cards)::boolean AS has_data,
    (SELECT cards FROM simulation_cards_agg) AS simulation_cards,
    (SELECT standard_groups FROM standard_groups_agg) AS standard_groups,
    (SELECT standards FROM standards_agg) AS standards
FROM profile_info pi
$$;
