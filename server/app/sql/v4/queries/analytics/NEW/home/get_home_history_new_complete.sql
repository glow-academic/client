-- Get NEW home history - raw attempt data for Python to process
-- REFACTORED: Uses mv_home_attempt_history + _resource tables only
-- Business logic (search, sort, pagination, score_status, filter options) moved to Python
--
-- Data flow:
-- 1. mv_home_attempt_history → raw attempt data (filtered by date, profile_id)
-- 2. Join to _resource tables → metadata (names, colors, etc.)
-- 3. Return raw data → Python does search, sort, pagination, computed fields

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_home_history_new_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_home_history_new_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_home_history_new_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
-- Raw attempt data type (Python will compute score_status, show_view, show_continue)
CREATE TYPE types.q_get_home_history_new_v4_raw_attempt AS (
    attempt_id uuid,
    attempt_created_at timestamptz,
    profile_id uuid,
    simulation_id uuid,
    cohort_id uuid,
    department_id uuid,
    -- From MV
    infinite_mode boolean,
    num_chats int,
    num_chats_completed int,
    num_scenarios int,
    num_scenarios_completed int,
    score_percent numeric,
    has_passed boolean,
    total_time_seconds int,
    rubric_total_points int,
    rubric_pass_points int,
    scenario_ids uuid[],
    persona_ids uuid[]
);

-- Simulation metadata
CREATE TYPE types.q_get_home_history_new_v4_simulation AS (
    simulation_id uuid,
    name text,
    description text,
    department_ids uuid[]
);

-- Profile metadata
CREATE TYPE types.q_get_home_history_new_v4_profile AS (
    profile_id uuid,
    name text
);

-- Persona metadata
CREATE TYPE types.q_get_home_history_new_v4_persona AS (
    persona_id uuid,
    name text,
    color text
);

-- Scenario metadata
CREATE TYPE types.q_get_home_history_new_v4_scenario AS (
    scenario_id uuid,
    name text
);

-- Cohort metadata
CREATE TYPE types.q_get_home_history_new_v4_cohort AS (
    cohort_id uuid,
    name text
);

-- Time limit per scenario
CREATE TYPE types.q_get_home_history_new_v4_time_limit AS (
    scenario_id uuid,
    time_limit_seconds int
);

-- 4) Recreate function
-- Simplified: only takes date range and profile_id for SQL filtering
-- Python handles: search, additional filters, sort, pagination
CREATE OR REPLACE FUNCTION api_get_home_history_new_v4(
    start_date text,
    end_date text,
    profile_id uuid,
    cohort_ids uuid[] DEFAULT ARRAY[]::uuid[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    actor_name text,
    -- Raw attempt data (Python will filter, sort, paginate, compute fields)
    raw_attempts types.q_get_home_history_new_v4_raw_attempt[],
    -- Metadata mappings for Python lookups
    simulations types.q_get_home_history_new_v4_simulation[],
    profiles types.q_get_home_history_new_v4_profile[],
    personas types.q_get_home_history_new_v4_persona[],
    scenarios types.q_get_home_history_new_v4_scenario[],
    cohorts types.q_get_home_history_new_v4_cohort[],
    time_limits types.q_get_home_history_new_v4_time_limit[]
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

-- Get profile info
profile_info AS (
    SELECT
        pr.id,
        pr.name
    FROM profiles_resource pr
    WHERE pr.id = (SELECT profile_id FROM params)
      AND pr.active = true
),

-- Get raw attempts from MV, filtered by date and profile
raw_attempts AS (
    SELECT
        mah.attempt_id,
        mah.attempt_created_at,
        mah.profile_id,
        mah.simulation_id,
        mah.cohort_id,
        mah.department_id,
        mah.infinite_mode,
        mah.num_chats,
        mah.num_chats_completed,
        mah.num_scenarios,
        mah.num_scenarios_completed,
        mah.score_percent,
        mah.has_passed,
        mah.total_time_seconds,
        mah.rubric_total_points,
        mah.rubric_pass_points,
        mah.scenario_ids,
        mah.persona_ids
    FROM params p
    CROSS JOIN mv_home_attempt_history mah
    WHERE mah.profile_id = p.profile_id
      AND mah.attempt_created_at >= p.start_date
      AND mah.attempt_created_at < p.end_date
      AND (cardinality(p.cohort_ids) = 0 OR mah.cohort_id = ANY(p.cohort_ids))
      AND (cardinality(p.department_ids) = 0 OR mah.department_id = ANY(p.department_ids))
),

-- Collect all unique IDs for metadata lookups
all_simulation_ids AS (
    SELECT DISTINCT simulation_id FROM raw_attempts WHERE simulation_id IS NOT NULL
),
all_persona_ids AS (
    SELECT DISTINCT pid AS persona_id
    FROM raw_attempts
    CROSS JOIN LATERAL unnest(persona_ids) AS pid
    WHERE pid IS NOT NULL
),
all_scenario_ids AS (
    SELECT DISTINCT sid AS scenario_id
    FROM raw_attempts
    CROSS JOIN LATERAL unnest(scenario_ids) AS sid
    WHERE sid IS NOT NULL
),
all_cohort_ids AS (
    SELECT DISTINCT cohort_id FROM raw_attempts WHERE cohort_id IS NOT NULL
),

-- Metadata: simulations
simulations_meta AS (
    SELECT
        (sr.id, sr.name, sr.description, sr.department_ids)::types.q_get_home_history_new_v4_simulation AS simulation
    FROM all_simulation_ids asi
    JOIN simulations_resource sr ON sr.id = asi.simulation_id AND sr.active = true
),

-- Metadata: profiles (just the current user for home history)
profiles_meta AS (
    SELECT
        (pi.id, pi.name)::types.q_get_home_history_new_v4_profile AS profile
    FROM profile_info pi
),

-- Metadata: personas
personas_meta AS (
    SELECT
        (pr.id, pr.name, pr.color)::types.q_get_home_history_new_v4_persona AS persona
    FROM all_persona_ids api
    JOIN personas_resource pr ON pr.id = api.persona_id AND pr.active = true
),

-- Metadata: scenarios
scenarios_meta AS (
    SELECT
        (sr.id, sr.name)::types.q_get_home_history_new_v4_scenario AS scenario
    FROM all_scenario_ids asi
    JOIN scenarios_resource sr ON sr.id = asi.scenario_id AND sr.active = true
),

-- Metadata: cohorts
cohorts_meta AS (
    SELECT
        (cr.id, cr.name)::types.q_get_home_history_new_v4_cohort AS cohort
    FROM all_cohort_ids aci
    JOIN cohorts_resource cr ON cr.id = aci.cohort_id AND cr.active = true
),

-- Metadata: time limits per scenario
time_limits_meta AS (
    SELECT
        (stlr.scenario_id, stlr.time_limit_seconds)::types.q_get_home_history_new_v4_time_limit AS time_limit
    FROM all_scenario_ids asi
    JOIN scenario_time_limits_resource stlr ON stlr.scenario_id = asi.scenario_id AND stlr.active = true
),

-- Aggregate raw attempts
raw_attempts_agg AS (
    SELECT COALESCE(ARRAY_AGG(
        (attempt_id, attempt_created_at, profile_id, simulation_id, cohort_id, department_id,
         infinite_mode, num_chats, num_chats_completed, num_scenarios, num_scenarios_completed,
         score_percent, has_passed, total_time_seconds, rubric_total_points, rubric_pass_points,
         scenario_ids, persona_ids
        )::types.q_get_home_history_new_v4_raw_attempt
        ORDER BY attempt_created_at DESC
    ), ARRAY[]::types.q_get_home_history_new_v4_raw_attempt[]) AS raw_attempts
    FROM raw_attempts
),

-- Aggregate metadata
simulations_agg AS (
    SELECT COALESCE(ARRAY_AGG(simulation), ARRAY[]::types.q_get_home_history_new_v4_simulation[]) AS simulations
    FROM simulations_meta
),
profiles_agg AS (
    SELECT COALESCE(ARRAY_AGG(profile), ARRAY[]::types.q_get_home_history_new_v4_profile[]) AS profiles
    FROM profiles_meta
),
personas_agg AS (
    SELECT COALESCE(ARRAY_AGG(persona), ARRAY[]::types.q_get_home_history_new_v4_persona[]) AS personas
    FROM personas_meta
),
scenarios_agg AS (
    SELECT COALESCE(ARRAY_AGG(scenario), ARRAY[]::types.q_get_home_history_new_v4_scenario[]) AS scenarios
    FROM scenarios_meta
),
cohorts_agg AS (
    SELECT COALESCE(ARRAY_AGG(cohort), ARRAY[]::types.q_get_home_history_new_v4_cohort[]) AS cohorts
    FROM cohorts_meta
),
time_limits_agg AS (
    SELECT COALESCE(ARRAY_AGG(time_limit), ARRAY[]::types.q_get_home_history_new_v4_time_limit[]) AS time_limits
    FROM time_limits_meta
)

SELECT
    COALESCE(pi.name, 'System')::text AS actor_name,
    (SELECT raw_attempts FROM raw_attempts_agg) AS raw_attempts,
    (SELECT simulations FROM simulations_agg) AS simulations,
    (SELECT profiles FROM profiles_agg) AS profiles,
    (SELECT personas FROM personas_agg) AS personas,
    (SELECT scenarios FROM scenarios_agg) AS scenarios,
    (SELECT cohorts FROM cohorts_agg) AS cohorts,
    (SELECT time_limits FROM time_limits_agg) AS time_limits
FROM profile_info pi
$$;
