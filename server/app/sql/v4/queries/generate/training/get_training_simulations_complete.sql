-- Get simulations available for training (OPERATIONAL)
-- Returns simulations user can take, scoped by their cohorts
-- Used by training/get.py for starting simulations

-- Drop existing function
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_training_simulations_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_training_simulations_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop existing types
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_training_simulations_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- Create composite types
CREATE TYPE types.q_get_training_simulations_v4_item AS (
    simulation_id uuid,
    simulation_name text,
    simulation_description text,
    time_limit int,
    scenario_ids uuid[],
    cohort_ids uuid[],
    -- Display metadata from first persona
    color text,
    icon text,
    -- Stats from mv_attempt_facts
    attempt_count int,
    highest_score_percent numeric,
    has_passed boolean,
    -- Cohort names for display
    cohort_names text[],
    -- Rubric data for pass_pct calculation
    standard_group_ids uuid[],
    rubric_total_points int,
    rubric_pass_points int
);

CREATE TYPE types.q_get_training_simulations_v4_standard_group AS (
    standard_group_id uuid,
    name text,
    description text,
    points int,
    pass_points int
);

CREATE TYPE types.q_get_training_simulations_v4_standard AS (
    standard_id uuid,
    standard_group_id uuid,
    name text,
    description text,
    points int
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_training_simulations_v4(
    p_profile_id uuid,
    p_practice boolean DEFAULT FALSE
)
RETURNS TABLE (
    actor_name text,
    user_role text,
    items types.q_get_training_simulations_v4_item[],
    standard_groups types.q_get_training_simulations_v4_standard_group[],
    standards types.q_get_training_simulations_v4_standard[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        p_profile_id AS profile_id,
        p_practice AS practice
),
-- Get user context
user_profile AS (
    SELECT actor_name, role
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
-- Get user's cohorts
user_cohorts AS (
    SELECT DISTINCT pc.cohort_id
    FROM params p
    JOIN profile_cohorts_junction pc ON pc.profile_id = p.profile_id AND pc.active = true
),
-- Get simulations from user's cohorts, filtered by practice mode
accessible_simulations AS (
    SELECT DISTINCT
        cs.simulation_id,
        cs.cohort_id
    FROM user_cohorts uc
    JOIN cohort_simulations_junction cs ON cs.cohort_id = uc.cohort_id AND cs.active = true
    JOIN simulation_artifact sa ON sa.id = cs.simulation_id
    -- Check simulation is active
    WHERE EXISTS (
        SELECT 1 FROM simulation_flags_junction sf
        JOIN flags_resource f ON sf.flag_id = f.id
        WHERE sf.simulation_id = sa.id AND f.name = 'simulation_active' AND sf.value = true
    )
    -- Filter by practice flag
    AND (
        (SELECT practice FROM params) = (
            SELECT COALESCE(sf.value, false)
            FROM simulation_flags_junction sf
            JOIN flags_resource f ON sf.flag_id = f.id
            WHERE sf.simulation_id = sa.id AND f.name = 'practice'
            LIMIT 1
        )
    )
),
-- Get simulation details
simulation_data AS (
    SELECT
        asim.simulation_id,
        -- Name
        (SELECT n.name FROM simulation_names_junction sn
         JOIN names_resource n ON sn.name_id = n.id
         WHERE sn.simulation_id = asim.simulation_id LIMIT 1) as simulation_name,
        -- Description
        COALESCE(
            (SELECT d.description FROM simulation_descriptions_junction sd
             JOIN descriptions_resource d ON sd.description_id = d.id
             WHERE sd.simulation_id = asim.simulation_id AND sd.active = true LIMIT 1),
            ''
        ) as simulation_description,
        -- Time limit (sum of scenario time limits)
        COALESCE(
            (SELECT SUM(stlr.time_limit_seconds)::int
             FROM simulation_scenario_time_limits_junction sstl
             JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id
             JOIN simulation_scenarios_junction ss ON ss.simulation_id = sstl.simulation_id
             JOIN scenarios_resource sr ON sr.id = ss.scenario_id
             JOIN scenario_scenarios_junction ssj ON ssj.scenarios_id = sr.id AND ssj.scenario_id = stlr.scenario_id
             WHERE sstl.simulation_id = asim.simulation_id
               AND sstl.active = true
               AND stlr.active = true
               AND EXISTS (SELECT 1 FROM scenario_flags_junction sf
                   JOIN flags_resource f ON sf.flag_id = f.id
                   WHERE sf.scenario_id = ssj.scenario_id AND f.name = 'scenario_active' AND sf.value = true)),
            0
        ) as time_limit,
        -- Scenario IDs (ordered by position)
        (SELECT ARRAY_AGG(sr.id ORDER BY COALESCE(
            (SELECT spr.value FROM simulation_scenario_positions_junction ssp
             JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id
             WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ssj.scenario_id
             LIMIT 1), 999999))
         FROM simulation_scenarios_junction ss
         JOIN scenarios_resource sr ON sr.id = ss.scenario_id
         JOIN scenario_scenarios_junction ssj ON ssj.scenarios_id = sr.id
         WHERE ss.simulation_id = asim.simulation_id
           AND ss.active = true
           AND EXISTS (SELECT 1 FROM scenario_flags_junction sf
               JOIN flags_resource f ON sf.flag_id = f.id
               WHERE sf.scenario_id = ssj.scenario_id AND f.name = 'scenario_active' AND sf.value = true)
        ) as scenario_ids,
        -- Cohort IDs this simulation belongs to (for user)
        (SELECT ARRAY_AGG(DISTINCT asim2.cohort_id)
         FROM accessible_simulations asim2
         WHERE asim2.simulation_id = asim.simulation_id
        ) as cohort_ids,
        -- Color from first scenario's persona
        (SELECT c.hex_code
         FROM simulation_scenarios_junction ss
         JOIN scenarios_resource sr ON sr.id = ss.scenario_id
         JOIN scenario_scenarios_junction ssj ON ssj.scenarios_id = sr.id
         JOIN scenario_personas_junction sp ON sp.scenario_id = ssj.scenario_id AND sp.active = true
         JOIN persona_colors_junction pc ON pc.persona_id = sp.persona_id
         JOIN colors_resource c ON c.id = pc.color_id
         WHERE ss.simulation_id = asim.simulation_id AND ss.active = true
         ORDER BY COALESCE(
             (SELECT spr.value FROM simulation_scenario_positions_junction ssp
              JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id
              WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ssj.scenario_id
              LIMIT 1), 999999)
         LIMIT 1
        ) as color,
        -- Icon from first scenario's persona
        (SELECT i.name
         FROM simulation_scenarios_junction ss
         JOIN scenarios_resource sr ON sr.id = ss.scenario_id
         JOIN scenario_scenarios_junction ssj ON ssj.scenarios_id = sr.id
         JOIN scenario_personas_junction sp ON sp.scenario_id = ssj.scenario_id AND sp.active = true
         JOIN persona_icons_junction pi ON pi.persona_id = sp.persona_id
         JOIN icons_resource i ON i.id = pi.icon_id
         WHERE ss.simulation_id = asim.simulation_id AND ss.active = true
         ORDER BY COALESCE(
             (SELECT spr.value FROM simulation_scenario_positions_junction ssp
              JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id
              WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ssj.scenario_id
              LIMIT 1), 999999)
         LIMIT 1
        ) as icon
    FROM (SELECT DISTINCT simulation_id FROM accessible_simulations) asim
),
-- Get all scenario IDs for rubric lookup
all_scenario_ids AS (
    SELECT DISTINCT unnest(scenario_ids) as scenario_id
    FROM simulation_data
    WHERE scenario_ids IS NOT NULL
),
-- Get rubric IDs for all scenarios
rubric_ids AS (
    SELECT DISTINCT srr.rubric_id
    FROM all_scenario_ids asi
    JOIN scenarios_resource sr ON sr.id = asi.scenario_id
    JOIN scenario_scenarios_junction ssj ON ssj.scenarios_id = sr.id
    JOIN scenario_rubrics_resource srr ON srr.scenario_id = ssj.scenario_id
    WHERE srr.active = true
),
-- Get standard groups from rubrics
standard_group_data AS (
    SELECT DISTINCT
        sg.id as standard_group_id,
        sg.name,
        sg.description,
        sg.points,
        sg.pass_points
    FROM rubric_ids ri
    JOIN rubric_standard_groups_junction rsg ON rsg.rubric_id = ri.rubric_id AND rsg.active = true
    JOIN standard_groups_resource sg ON sg.id = rsg.standard_group_id AND sg.active = true
),
-- Get standards from standard groups
standard_data AS (
    SELECT DISTINCT
        s.id as standard_id,
        s.standard_group_id,
        s.name,
        s.description,
        s.points
    FROM standard_group_data sgd
    JOIN standards_resource s ON s.standard_group_id = sgd.standard_group_id AND s.active = true
),
-- Get profile's profiles_id for mv_attempt_facts lookup
profile_resource AS (
    SELECT ppj.profiles_id
    FROM params p
    JOIN profile_profiles_junction ppj ON ppj.profile_id = p.profile_id AND ppj.active = true
    LIMIT 1
),
-- Aggregate attempt stats per simulation from mv_attempt_facts
simulation_stats AS (
    SELECT
        af.simulation_id,
        COUNT(DISTINCT af.attempt_id)::int AS attempt_count,
        MAX(af.score_percent) AS highest_score_percent,
        BOOL_OR(af.has_passed) AS has_passed
    FROM mv_attempt_facts af
    WHERE af.profile_id = (SELECT profiles_id FROM profile_resource)
      AND af.attempt_type = CASE WHEN (SELECT practice FROM params) THEN 'practice' ELSE 'general' END
      AND af.is_archived = FALSE
    GROUP BY af.simulation_id
),
-- Get cohort names for each simulation
simulation_cohort_names AS (
    SELECT
        asim.simulation_id,
        ARRAY_AGG(DISTINCT cn.name ORDER BY cn.name) as cohort_names
    FROM accessible_simulations asim
    JOIN cohort_names_junction cnj ON cnj.cohort_id = asim.cohort_id
    JOIN names_resource cn ON cn.id = cnj.name_id
    GROUP BY asim.simulation_id
),
-- Get standard group IDs and rubric points per simulation
simulation_rubric_data AS (
    SELECT
        sd.simulation_id,
        ARRAY_AGG(DISTINCT sg.id) as standard_group_ids,
        COALESCE(SUM(DISTINCT sg.points), 0)::int as rubric_total_points,
        COALESCE(SUM(DISTINCT sg.pass_points), 0)::int as rubric_pass_points
    FROM simulation_data sd
    CROSS JOIN LATERAL unnest(sd.scenario_ids) AS scn_id
    JOIN scenarios_resource sr ON sr.id = scn_id
    JOIN scenario_scenarios_junction ssj ON ssj.scenarios_id = sr.id
    JOIN scenario_rubrics_resource srr ON srr.scenario_id = ssj.scenario_id AND srr.active = true
    JOIN rubric_standard_groups_junction rsg ON rsg.rubric_id = srr.rubric_id AND rsg.active = true
    JOIN standard_groups_resource sg ON sg.id = rsg.standard_group_id AND sg.active = true
    GROUP BY sd.simulation_id
),
-- Combined simulation data with stats
simulation_data_with_stats AS (
    SELECT
        sd.*,
        COALESCE(ss.attempt_count, 0) as attempt_count,
        ss.highest_score_percent,
        COALESCE(ss.has_passed, false) as has_passed,
        scn.cohort_names,
        srd.standard_group_ids,
        srd.rubric_total_points,
        srd.rubric_pass_points
    FROM simulation_data sd
    LEFT JOIN simulation_stats ss ON ss.simulation_id = sd.simulation_id
    LEFT JOIN simulation_cohort_names scn ON scn.simulation_id = sd.simulation_id
    LEFT JOIN simulation_rubric_data srd ON srd.simulation_id = sd.simulation_id
)
SELECT
    (SELECT actor_name FROM user_profile) as actor_name,
    (SELECT role::text FROM user_profile) as user_role,
    -- Simulations with stats
    COALESCE(
        (SELECT ARRAY_AGG(
            (sd.simulation_id, sd.simulation_name, sd.simulation_description, sd.time_limit,
             sd.scenario_ids, sd.cohort_ids, sd.color, sd.icon,
             sd.attempt_count, sd.highest_score_percent, sd.has_passed,
             sd.cohort_names, sd.standard_group_ids, sd.rubric_total_points, sd.rubric_pass_points
            )::types.q_get_training_simulations_v4_item
            ORDER BY sd.simulation_name
        ) FROM simulation_data_with_stats sd WHERE sd.scenario_ids IS NOT NULL AND ARRAY_LENGTH(sd.scenario_ids, 1) > 0),
        ARRAY[]::types.q_get_training_simulations_v4_item[]
    ) as items,
    -- Standard groups
    COALESCE(
        (SELECT ARRAY_AGG(
            (sgd.standard_group_id, sgd.name, sgd.description, sgd.points, sgd.pass_points
            )::types.q_get_training_simulations_v4_standard_group
            ORDER BY sgd.name
        ) FROM standard_group_data sgd),
        ARRAY[]::types.q_get_training_simulations_v4_standard_group[]
    ) as standard_groups,
    -- Standards
    COALESCE(
        (SELECT ARRAY_AGG(
            (sd.standard_id, sd.standard_group_id, sd.name, sd.description, sd.points
            )::types.q_get_training_simulations_v4_standard
            ORDER BY sd.name
        ) FROM standard_data sd),
        ARRAY[]::types.q_get_training_simulations_v4_standard[]
    ) as standards;
$$;
