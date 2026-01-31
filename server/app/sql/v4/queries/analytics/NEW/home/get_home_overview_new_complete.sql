-- Get NEW home overview using MVs (mv_home_simulation_status)
-- Simple SELECT from MVs with JOINs to _resource tables for metadata
-- No complex business logic - just data retrieval

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
CREATE TYPE types.q_get_home_overview_new_v4_simulation_card AS (
    simulation_id uuid,
    simulation_name text,
    simulation_description text,
    icon text,
    color text,
    cohort_id uuid,
    cohort_name text,
    attempt_count int,
    completed_count int,
    highest_score numeric,
    has_passed boolean,
    status text,  -- 'passed' | 'in-progress' | 'not-started'
    first_attempt_at timestamptz,
    last_attempt_at timestamptz,
    pass_threshold numeric
);

CREATE TYPE types.q_get_home_overview_new_v4_standard_group AS (
    standard_group_id uuid,
    name text,
    description text,
    points int,
    pass_points int
);

CREATE TYPE types.q_get_home_overview_new_v4_standard AS (
    standard_id uuid,
    standard_group_id uuid,
    name text,
    description text,
    points int
);

CREATE TYPE types.q_get_home_overview_new_v4_simulation AS (
    simulation_id uuid,
    name text,
    description text,
    time_limit int,
    department_ids uuid[]
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_home_overview_new_v4(
    start_date text,
    end_date text,
    profile_id uuid,
    cohort_ids uuid[] DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
    actor_name text,
    mode text,
    items types.q_get_home_overview_new_v4_simulation_card[],
    standard_groups types.q_get_home_overview_new_v4_standard_group[],
    standards types.q_get_home_overview_new_v4_standard[],
    simulations types.q_get_home_overview_new_v4_simulation[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        start_date::timestamptz AS start_date,
        end_date::timestamptz AS end_date,
        profile_id AS profile_id,
        cohort_ids AS cohort_ids,
        department_ids AS department_ids
),
-- Get profile info and determine mode
profile_info AS (
    SELECT
        pr.id,
        pr.name AS actor_name,
        pr.role,
        CASE
            WHEN pr.role IN ('instructional', 'admin', 'superadmin') THEN 'instructional'
            ELSE 'member'
        END AS mode
    FROM profiles_resource pr
    CROSS JOIN params p
    WHERE pr.id = p.profile_id
),
-- Query mv_home_simulation_status with filters
simulation_cards AS (
    SELECT
        s.simulation_id,
        sim.name AS simulation_name,
        sim.description AS simulation_description,
        NULL::text AS icon,  -- icon from persona, not stored on simulation
        NULL::text AS color, -- color from persona, not stored on simulation
        s.cohort_id,
        cr.name AS cohort_name,
        s.attempt_count,
        s.completed_count,
        s.highest_score,
        s.has_passed,
        s.status,
        s.first_attempt_at,
        s.last_attempt_at,
        cert.pass_threshold
    FROM mv_home_simulation_status s
    CROSS JOIN params p
    JOIN simulations_resource sim ON sim.id = s.simulation_id
    LEFT JOIN cohorts_resource cr ON cr.id = s.cohort_id
    LEFT JOIN mv_home_certificate_status cert
        ON cert.profile_id = s.profile_id
        AND cert.simulation_id = s.simulation_id
        AND cert.cohort_id = s.cohort_id
    WHERE s.profile_id = p.profile_id
      AND (p.cohort_ids IS NULL OR s.cohort_id = ANY(p.cohort_ids))
      AND s.first_attempt_at >= p.start_date
      AND s.last_attempt_at <= p.end_date
),
-- Collect unique simulation IDs
simulation_ids AS (
    SELECT DISTINCT simulation_id FROM simulation_cards
),
-- Simulation mappings
simulation_mappings AS (
    SELECT
        sr.id AS simulation_id,
        sr.name,
        sr.description,
        NULL::int AS time_limit,  -- time_limit is on scenario, not simulation
        sr.department_ids
    FROM simulations_resource sr
    WHERE sr.id IN (SELECT simulation_id FROM simulation_ids)
),
-- Standard groups
standard_groups_data AS (
    SELECT
        sg.id AS standard_group_id,
        sg.name,
        sg.description,
        COALESCE(sg.points, 0) AS points,
        COALESCE(sg.pass_points, 0) AS pass_points
    FROM standard_groups_resource sg
    WHERE sg.active = TRUE
),
-- Standards (standard_group_id is directly on standards_resource)
standards_data AS (
    SELECT
        s.id AS standard_id,
        s.standard_group_id,
        s.name,
        s.description,
        COALESCE(s.points, 0) AS points
    FROM standards_resource s
    WHERE s.active = TRUE
      AND s.standard_group_id IS NOT NULL
),
-- Aggregate items
items_agg AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (
                sc.simulation_id,
                sc.simulation_name,
                sc.simulation_description,
                sc.icon,
                sc.color,
                sc.cohort_id,
                sc.cohort_name,
                sc.attempt_count,
                sc.completed_count,
                sc.highest_score,
                sc.has_passed,
                sc.status,
                sc.first_attempt_at,
                sc.last_attempt_at,
                sc.pass_threshold
            )::types.q_get_home_overview_new_v4_simulation_card
            ORDER BY sc.last_attempt_at DESC NULLS LAST
        ),
        '{}'::types.q_get_home_overview_new_v4_simulation_card[]
    ) AS items
    FROM simulation_cards sc
),
-- Aggregate standard groups
standard_groups_agg AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (
                sg.standard_group_id,
                sg.name,
                sg.description,
                sg.points,
                sg.pass_points
            )::types.q_get_home_overview_new_v4_standard_group
        ),
        '{}'::types.q_get_home_overview_new_v4_standard_group[]
    ) AS standard_groups
    FROM standard_groups_data sg
),
-- Aggregate standards
standards_agg AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (
                s.standard_id,
                s.standard_group_id,
                s.name,
                s.description,
                s.points
            )::types.q_get_home_overview_new_v4_standard
        ),
        '{}'::types.q_get_home_overview_new_v4_standard[]
    ) AS standards
    FROM standards_data s
),
-- Aggregate simulation mappings
simulations_agg AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (
                sm.simulation_id,
                sm.name,
                sm.description,
                sm.time_limit,
                COALESCE(sm.department_ids, ARRAY[]::uuid[])
            )::types.q_get_home_overview_new_v4_simulation
        ),
        '{}'::types.q_get_home_overview_new_v4_simulation[]
    ) AS simulations
    FROM simulation_mappings sm
)
SELECT
    pi.actor_name,
    pi.mode,
    (SELECT items FROM items_agg),
    (SELECT standard_groups FROM standard_groups_agg),
    (SELECT standards FROM standards_agg),
    (SELECT simulations FROM simulations_agg)
FROM profile_info pi
$$;
