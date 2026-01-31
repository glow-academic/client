-- Get NEW home overview with items and mappings
-- REFACTORED: Uses mv_home_attempt_history + _resource tables only
-- Business logic (status, pass_pct, completion_pct, cohort formatting) moved to Python
--
-- Data flow:
-- 1. mv_home_attempt_history → raw attempt data (filtered by date, profile/cohort)
-- 2. Aggregate by simulation_id → simulation-level metrics
-- 3. Join to _resource tables → metadata (names, colors, etc.)
-- 4. Return raw data → Python computes status, pass_pct, formats cohort names

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
-- Raw simulation data type (Python will compute status, pass_pct, etc.)
CREATE TYPE types.q_get_home_overview_new_v4_raw_simulation AS (
    simulation_id uuid,
    -- Metrics from MV aggregation
    attempt_count int,
    completed_count int,
    highest_score int,
    has_passed boolean,
    -- Rubric points (for Python to compute pass_pct)
    rubric_total_points int,
    rubric_pass_points int,
    -- IDs for metadata lookups
    persona_ids uuid[],
    cohort_ids uuid[],
    -- Instructional mode counts (NULL for member mode)
    passed_count int,
    in_progress_count int,
    not_started_count int,
    total_members int
);

-- Simulation metadata mapping
CREATE TYPE types.q_get_home_overview_new_v4_simulation AS (
    simulation_id uuid,
    name text,
    description text,
    time_limit int,
    department_ids text[]
);

-- Persona metadata mapping
CREATE TYPE types.q_get_home_overview_new_v4_persona AS (
    persona_id uuid,
    color text,
    icon text
);

-- Cohort metadata mapping
CREATE TYPE types.q_get_home_overview_new_v4_cohort AS (
    cohort_id uuid,
    name text
);

-- Standard group mapping
CREATE TYPE types.q_get_home_overview_new_v4_standard_group AS (
    standard_group_id uuid,
    name text,
    description text,
    points int,
    pass_points int
);

-- Standard mapping
CREATE TYPE types.q_get_home_overview_new_v4_standard AS (
    standard_id uuid,
    standard_group_id uuid,
    name text,
    description text,
    points int
);

-- Rubric to standard_groups mapping
CREATE TYPE types.q_get_home_overview_new_v4_rubric AS (
    simulation_id uuid,
    rubric_id uuid,
    standard_group_ids uuid[]
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
    -- Raw simulation data (Python will transform to simulation cards)
    raw_simulations types.q_get_home_overview_new_v4_raw_simulation[],
    -- Metadata mappings (Python will use for lookups)
    simulations types.q_get_home_overview_new_v4_simulation[],
    personas types.q_get_home_overview_new_v4_persona[],
    cohorts types.q_get_home_overview_new_v4_cohort[],
    rubrics types.q_get_home_overview_new_v4_rubric[],
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
      AND (cardinality(p.department_ids) = 0 OR cr.department_ids && p.department_ids)
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
        ARRAY_AGG(DISTINCT mah.cohort_id) FILTER (WHERE mah.cohort_id IS NOT NULL) AS cohort_ids
    FROM params p
    CROSS JOIN mode_info mi
    CROSS JOIN mv_home_attempt_history mah
    CROSS JOIN LATERAL unnest(mah.persona_ids) AS pid
    WHERE mi.is_member_mode
      AND mah.profile_id = p.profile_id
      AND mah.attempt_created_at >= p.start_date
      AND mah.attempt_created_at < p.end_date
      AND mah.simulation_id IN (SELECT simulation_id FROM cohort_simulations)
      AND (cardinality(p.cohort_ids) = 0 OR mah.cohort_id = ANY(p.cohort_ids))
      AND (cardinality(p.department_ids) = 0 OR mah.department_id = ANY(p.department_ids))
    GROUP BY mah.simulation_id
),

-- INSTRUCTIONAL MODE: First get per-profile status, then aggregate
-- Step 1: Get each profile's overall status per simulation
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
    CROSS JOIN mv_home_attempt_history mah
    LEFT JOIN LATERAL unnest(mah.persona_ids) AS pid ON true
    WHERE NOT mi.is_member_mode
      AND mah.attempt_created_at >= p.start_date
      AND mah.attempt_created_at < p.end_date
      AND mah.simulation_id IN (SELECT simulation_id FROM cohort_simulations)
      AND (cardinality(p.cohort_ids) = 0 OR mah.cohort_id = ANY(p.cohort_ids))
      AND (cardinality(p.department_ids) = 0 OR mah.department_id = ANY(p.department_ids))
    GROUP BY mah.simulation_id, mah.profile_id
),

-- Step 2a: Aggregate persona_ids per simulation
inst_persona_ids AS (
    SELECT
        simulation_id,
        ARRAY_AGG(DISTINCT pid) FILTER (WHERE pid IS NOT NULL) AS persona_ids
    FROM inst_profile_status
    CROSS JOIN LATERAL unnest(persona_ids) AS pid
    GROUP BY simulation_id
),

-- Step 2b: Aggregate cohort_ids per simulation
inst_cohort_ids AS (
    SELECT
        simulation_id,
        ARRAY_AGG(DISTINCT cid) FILTER (WHERE cid IS NOT NULL) AS cohort_ids
    FROM inst_profile_status
    CROSS JOIN LATERAL unnest(cohort_ids) AS cid
    GROUP BY simulation_id
),

-- Step 2c: Aggregate profile statuses per simulation
inst_sim_status AS (
    SELECT
        ips.simulation_id,
        COUNT(*)::int AS attempt_count,  -- total profiles with attempts
        COUNT(*) FILTER (WHERE ips.profile_has_completed)::int AS completed_count,
        MAX(ips.profile_highest_score)::int AS highest_score,
        BOOL_OR(ips.profile_has_passed) AS has_passed,
        MAX(ips.rubric_total_points) AS rubric_total_points,
        MAX(ips.rubric_pass_points) AS rubric_pass_points,
        COALESCE(ipi.persona_ids, ARRAY[]::uuid[]) AS persona_ids,
        COALESCE(ici.cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
        -- Count profiles by mutually exclusive status
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
        NULL::int AS passed_count,
        NULL::int AS in_progress_count,
        NULL::int AS not_started_count,
        NULL::int AS total_members
    FROM member_sim_status
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

-- Get all simulation IDs we need metadata for
all_simulation_ids AS (
    SELECT DISTINCT simulation_id FROM all_sim_status
),

-- Get all persona IDs we need metadata for
all_persona_ids AS (
    SELECT DISTINCT pid AS persona_id
    FROM all_sim_status
    CROSS JOIN LATERAL unnest(persona_ids) AS pid
),

-- Get all cohort IDs we need metadata for
all_cohort_ids AS (
    SELECT DISTINCT cid AS cohort_id
    FROM all_sim_status
    CROSS JOIN LATERAL unnest(cohort_ids) AS cid
),

-- Get scenario IDs for time limit calculation
sim_scenarios AS (
    SELECT DISTINCT
        mah.simulation_id,
        sid AS scenario_id
    FROM mv_home_attempt_history mah
    CROSS JOIN LATERAL unnest(mah.scenario_ids) AS sid
    WHERE mah.simulation_id IN (SELECT simulation_id FROM all_simulation_ids)
),

-- Get time limits per simulation from scenario_time_limits_resource
sim_time_limits AS (
    SELECT
        ss.simulation_id,
        COALESCE(SUM(stlr.time_limit_seconds), 0)::int AS time_limit
    FROM sim_scenarios ss
    LEFT JOIN scenario_time_limits_resource stlr
        ON stlr.scenario_id = ss.scenario_id AND stlr.active = true
    GROUP BY ss.simulation_id
),

-- Get rubric info per simulation from scenario_rubrics_resource
sim_rubrics AS (
    SELECT DISTINCT ON (ss.simulation_id)
        ss.simulation_id,
        srr.rubric_id
    FROM sim_scenarios ss
    JOIN scenario_rubrics_resource srr
        ON srr.scenario_id = ss.scenario_id AND srr.active = true
    ORDER BY ss.simulation_id, srr.created_at
),

-- Metadata: simulations
simulations_meta AS (
    SELECT
        (sr.id, sr.name, sr.description, COALESCE(stl.time_limit, 0),
         COALESCE(sr.department_ids::text[], ARRAY[]::text[]))::types.q_get_home_overview_new_v4_simulation AS simulation
    FROM all_simulation_ids asi
    JOIN simulations_resource sr ON sr.id = asi.simulation_id AND sr.active = true
    LEFT JOIN sim_time_limits stl ON stl.simulation_id = sr.id
),

-- Metadata: personas
personas_meta AS (
    SELECT
        (pr.id, pr.color, pr.icon)::types.q_get_home_overview_new_v4_persona AS persona
    FROM all_persona_ids api
    JOIN personas_resource pr ON pr.id = api.persona_id AND pr.active = true
),

-- Metadata: cohorts
cohorts_meta AS (
    SELECT
        (cr.id, cr.name)::types.q_get_home_overview_new_v4_cohort AS cohort
    FROM all_cohort_ids aci
    JOIN cohorts_resource cr ON cr.id = aci.cohort_id AND cr.active = true
),

-- Metadata: rubrics with standard_group_ids
rubrics_meta AS (
    SELECT
        (smr.simulation_id, rr.id, rr.standard_group_ids)::types.q_get_home_overview_new_v4_rubric AS rubric
    FROM sim_rubrics smr
    JOIN rubrics_resource rr ON rr.id = smr.rubric_id AND rr.active = true
),

-- Get all standard_group_ids from rubrics
all_standard_group_ids AS (
    SELECT DISTINCT unnest(rr.standard_group_ids) AS standard_group_id
    FROM sim_rubrics smr
    JOIN rubrics_resource rr ON rr.id = smr.rubric_id AND rr.active = true
),

-- Metadata: standard_groups
standard_groups_meta AS (
    SELECT
        (sg.id, sg.name, sg.description, sg.points, sg.pass_points)::types.q_get_home_overview_new_v4_standard_group AS standard_group
    FROM all_standard_group_ids asgi
    JOIN standard_groups_resource sg ON sg.id = asgi.standard_group_id AND sg.active = true
),

-- Metadata: standards
standards_meta AS (
    SELECT
        (st.id, st.standard_group_id, st.name, st.description, st.points)::types.q_get_home_overview_new_v4_standard AS standard
    FROM standards_resource st
    WHERE st.standard_group_id IN (SELECT standard_group_id FROM all_standard_group_ids)
      AND st.active = true
),

-- Build raw simulations array
raw_simulations_agg AS (
    SELECT COALESCE(ARRAY_AGG(
        (simulation_id, attempt_count, completed_count, highest_score, has_passed,
         rubric_total_points, rubric_pass_points, persona_ids, cohort_ids,
         passed_count, in_progress_count, not_started_count, total_members
        )::types.q_get_home_overview_new_v4_raw_simulation
    ), ARRAY[]::types.q_get_home_overview_new_v4_raw_simulation[]) AS raw_simulations
    FROM all_sim_status
),

-- Aggregate metadata
simulations_agg AS (
    SELECT COALESCE(ARRAY_AGG(simulation), ARRAY[]::types.q_get_home_overview_new_v4_simulation[]) AS simulations
    FROM simulations_meta
),
personas_agg AS (
    SELECT COALESCE(ARRAY_AGG(persona), ARRAY[]::types.q_get_home_overview_new_v4_persona[]) AS personas
    FROM personas_meta
),
cohorts_agg AS (
    SELECT COALESCE(ARRAY_AGG(cohort), ARRAY[]::types.q_get_home_overview_new_v4_cohort[]) AS cohorts
    FROM cohorts_meta
),
rubrics_agg AS (
    SELECT COALESCE(ARRAY_AGG(rubric), ARRAY[]::types.q_get_home_overview_new_v4_rubric[]) AS rubrics
    FROM rubrics_meta
),
standard_groups_agg AS (
    SELECT COALESCE(ARRAY_AGG(standard_group), ARRAY[]::types.q_get_home_overview_new_v4_standard_group[]) AS standard_groups
    FROM standard_groups_meta
),
standards_agg AS (
    SELECT COALESCE(ARRAY_AGG(standard), ARRAY[]::types.q_get_home_overview_new_v4_standard[]) AS standards
    FROM standards_meta
)

SELECT
    COALESCE(pi.name, 'System')::text AS actor_name,
    COALESCE(mi.mode, 'instructional')::text AS mode,
    (SELECT COUNT(*) > 0 FROM all_sim_status)::boolean AS has_data,
    (SELECT raw_simulations FROM raw_simulations_agg) AS raw_simulations,
    (SELECT simulations FROM simulations_agg) AS simulations,
    (SELECT personas FROM personas_agg) AS personas,
    (SELECT cohorts FROM cohorts_agg) AS cohorts,
    (SELECT rubrics FROM rubrics_agg) AS rubrics,
    (SELECT standard_groups FROM standard_groups_agg) AS standard_groups,
    (SELECT standards FROM standards_agg) AS standards
FROM profile_info pi
CROSS JOIN mode_info mi
$$;
