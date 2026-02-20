-- Get simulations available for training (OPERATIONAL)
-- IDs-first contract for artifact-level hydration in Python.

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

CREATE TYPE types.q_get_training_simulations_v4_item AS (
    simulation_id uuid,
    scenario_ids uuid[],
    cohort_ids uuid[],
    color text,
    icon text,
    attempt_count int,
    highest_score_percent numeric,
    has_passed boolean,
    standard_group_ids uuid[],
    rubric_total_points int,
    rubric_pass_points int
);

CREATE OR REPLACE FUNCTION api_get_training_simulations_v4(
    p_profile_id uuid,
    p_practice boolean DEFAULT FALSE
)
RETURNS TABLE (
    items types.q_get_training_simulations_v4_item[],
    standard_group_ids uuid[],
    standard_ids uuid[]
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        p_profile_id AS profile_id,
        p_practice AS practice
),
user_cohorts AS (
    SELECT ARRAY_AGG(DISTINCT ccj.cohorts_id) AS cohort_ids
    FROM profile_cohorts_junction pcj
    JOIN cohort_cohorts_junction ccj
      ON ccj.cohorts_id = pcj.cohort_id
     AND ccj.active = true
    WHERE pcj.profile_id = (SELECT profile_id FROM params)
      AND pcj.active = true
),
accessible_training AS (
    SELECT
        mh.home_id AS parent_id,
        mh.simulation_ids,
        mh.cohort_ids,
        mh.training_ids AS training_entry_ids,
        mh.scenario_ids,
        mh.persona_ids,
        mh.rubric_ids,
        mh.time_limit_ids
    FROM home_mv mh
    JOIN user_cohorts uc ON mh.cohort_ids && COALESCE(uc.cohort_ids, ARRAY[]::uuid[])
    WHERE (SELECT practice FROM params) = false

    UNION ALL

    SELECT
        mp.practice_id AS parent_id,
        mp.simulation_ids,
        mp.cohort_ids,
        mp.training_ids AS training_entry_ids,
        mp.scenario_ids,
        mp.persona_ids,
        mp.rubric_ids,
        mp.time_limit_ids
    FROM practice_mv mp
    JOIN user_cohorts uc ON mp.cohort_ids && COALESCE(uc.cohort_ids, ARRAY[]::uuid[])
    WHERE (SELECT practice FROM params) = true
),
-- Unnest simulation_ids from home_mv/practice_mv, check simulation_active flag
active_simulations AS (
    SELECT DISTINCT sid.simulation_id
    FROM accessible_training at2
    CROSS JOIN LATERAL unnest(at2.simulation_ids) sid(simulation_id)
    JOIN simulation_simulations_junction ssj
      ON ssj.simulations_id = sid.simulation_id AND ssj.active = true
    JOIN simulation_artifact sa
      ON sa.id = ssj.simulation_id
    WHERE EXISTS (
        SELECT 1
        FROM simulation_flags_junction sf
        JOIN flags_resource f ON f.id = sf.flag_id
        WHERE sf.simulation_id = sa.id
          AND f.name = 'simulation_active'
          AND sf.value = true
    )
),
-- Group by simulation: aggregate IDs from all training rows that contain this simulation
simulation_data AS (
    SELECT
        asim.simulation_id,
        ARRAY_AGG(DISTINCT scid.scenario_id ORDER BY scid.scenario_id)
            FILTER (WHERE scid.scenario_id IS NOT NULL) AS scenario_ids,
        ARRAY_AGG(DISTINCT coid.cohort_id ORDER BY coid.cohort_id)
            FILTER (WHERE coid.cohort_id IS NOT NULL) AS cohort_ids
    FROM active_simulations asim
    JOIN accessible_training at2
      ON asim.simulation_id = ANY(at2.simulation_ids)
    LEFT JOIN LATERAL unnest(at2.scenario_ids) scid(scenario_id) ON TRUE
    LEFT JOIN LATERAL unnest(at2.cohort_ids) coid(cohort_id) ON TRUE
    GROUP BY asim.simulation_id
),
first_scenario_persona AS (
    SELECT
        sd.simulation_id,
        (
            SELECT sp.persona_id
            FROM unnest(COALESCE(sd.scenario_ids, ARRAY[]::uuid[])) WITH ORDINALITY sid(scenarios_id, ord)
            JOIN scenario_scenarios_junction ssj ON ssj.scenarios_id = sid.scenarios_id AND ssj.active = true
            JOIN scenario_personas_junction sp ON sp.scenario_id = ssj.scenario_id AND sp.active = true
            ORDER BY sid.ord
            LIMIT 1
        ) AS persona_id
    FROM simulation_data sd
),
persona_display AS (
    SELECT
        fsp.simulation_id,
        (SELECT c.hex_code
         FROM persona_colors_junction pc
         JOIN colors_resource c ON c.id = pc.color_id
         WHERE pc.persona_id = fsp.persona_id
         LIMIT 1) AS color,
        (SELECT i.name
         FROM persona_icons_junction pi
         JOIN icons_resource i ON i.id = pi.icon_id
         WHERE pi.persona_id = fsp.persona_id
         LIMIT 1) AS icon
    FROM first_scenario_persona fsp
),
all_scenario_ids AS (
    SELECT DISTINCT unnest(COALESCE(sd.scenario_ids, ARRAY[]::uuid[])) AS scenario_id
    FROM simulation_data sd
),
rubric_ids AS (
    SELECT DISTINCT srr.rubric_id
    FROM all_scenario_ids asi
    JOIN scenario_rubrics_resource srr
      ON srr.scenario_id = asi.scenario_id
     AND srr.active = true
),
standard_group_data AS (
    SELECT DISTINCT sg.id AS standard_group_id
    FROM rubric_ids ri
    JOIN rubric_standard_groups_junction rsg ON rsg.rubric_id = ri.rubric_id AND rsg.active = true
    JOIN standard_groups_resource sg ON sg.id = rsg.standard_group_id AND sg.active = true
),
standard_data AS (
    SELECT DISTINCT s.id AS standard_id
    FROM standard_group_data sgd
    JOIN standards_resource s ON s.standard_group_id = sgd.standard_group_id AND s.active = true
),
simulation_rubric_data AS (
    SELECT
        sd.simulation_id,
        ARRAY_AGG(DISTINCT sg.id ORDER BY sg.id) AS standard_group_ids,
        COALESCE(SUM(DISTINCT sg.points), 0)::int AS rubric_total_points,
        COALESCE(SUM(DISTINCT sg.pass_points), 0)::int AS rubric_pass_points
    FROM simulation_data sd
    CROSS JOIN LATERAL unnest(COALESCE(sd.scenario_ids, ARRAY[]::uuid[])) AS sid(scenario_id)
    JOIN scenario_rubrics_resource srr ON srr.scenario_id = sid.scenario_id AND srr.active = true
    JOIN rubric_standard_groups_junction rsg ON rsg.rubric_id = srr.rubric_id AND rsg.active = true
    JOIN standard_groups_resource sg ON sg.id = rsg.standard_group_id AND sg.active = true
    GROUP BY sd.simulation_id
),
profile_resource AS (
    SELECT ppj.profiles_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = (SELECT profile_id FROM params)
      AND ppj.active = true
    LIMIT 1
),
latest_attempt_grades AS (
    SELECT
        a.id AS attempt_id,
        MAX(g.score) AS score_percent,
        BOOL_OR(g.passed) AS has_passed
    FROM attempt_entry a
    LEFT JOIN attempt_chat_entry ac ON ac.attempt_id = a.id
    LEFT JOIN chat_resolved_entry c ON c.id = ac.chat_resolved_id AND c.active = true
    LEFT JOIN attempt_grade_entry g ON g.chat_id = c.id AND g.active = true
    LEFT JOIN LATERAL (
        SELECT archived FROM attempt_archive_entry
        WHERE attempt_id = a.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
    ) sa_archive ON true
    WHERE a.active = true
      AND COALESCE(sa_archive.archived, false) = false
    GROUP BY a.id
),
simulation_stats AS (
    SELECT
        COALESCE(hsc.simulations_id, psc.simulations_id) AS simulation_id,
        COUNT(DISTINCT a.id)::int AS attempt_count,
        MAX(lag.score_percent) AS highest_score_percent,
        BOOL_OR(COALESCE(lag.has_passed, false)) AS has_passed
    FROM profile_resource pr
    JOIN attempt_profiles_connection apc
      ON apc.profiles_id = pr.profiles_id
     AND apc.active = true
    JOIN attempt_entry a
      ON a.id = apc.attempt_id
     AND a.active = true
     AND a.practice = (SELECT practice FROM params)
    LEFT JOIN LATERAL (
        SELECT archived FROM attempt_archive_entry
        WHERE attempt_id = a.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
    ) sa_archive2 ON true
    LEFT JOIN attempt_home_entry ahc ON ahc.attempt_id = a.id AND ahc.active = true
    LEFT JOIN home_simulations_connection hsc ON hsc.home_id = ahc.home_id AND hsc.active = true
    LEFT JOIN attempt_practice_entry ape ON ape.attempt_id = a.id AND ape.active = true
    LEFT JOIN practice_simulations_connection psc ON psc.practice_id = ape.practice_id AND psc.active = true
    LEFT JOIN latest_attempt_grades lag ON lag.attempt_id = a.id
    WHERE COALESCE(sa_archive2.archived, false) = false
    GROUP BY COALESCE(hsc.simulations_id, psc.simulations_id)
),
simulation_data_with_stats AS (
    SELECT
        sd.simulation_id,
        sd.scenario_ids,
        sd.cohort_ids,
        pd.color,
        pd.icon,
        COALESCE(ss.attempt_count, 0) AS attempt_count,
        ss.highest_score_percent,
        COALESCE(ss.has_passed, false) AS has_passed,
        srd.standard_group_ids,
        srd.rubric_total_points,
        srd.rubric_pass_points
    FROM simulation_data sd
    LEFT JOIN persona_display pd ON pd.simulation_id = sd.simulation_id
    LEFT JOIN simulation_stats ss ON ss.simulation_id = sd.simulation_id
    LEFT JOIN simulation_rubric_data srd ON srd.simulation_id = sd.simulation_id
)
SELECT
    COALESCE(
        (
            SELECT ARRAY_AGG(
                (
                    sd.simulation_id,
                    sd.scenario_ids,
                    sd.cohort_ids,
                    sd.color,
                    sd.icon,
                    sd.attempt_count,
                    sd.highest_score_percent,
                    sd.has_passed,
                    sd.standard_group_ids,
                    sd.rubric_total_points,
                    sd.rubric_pass_points
                )::types.q_get_training_simulations_v4_item
                ORDER BY sd.simulation_id
            )
            FROM simulation_data_with_stats sd
            WHERE sd.scenario_ids IS NOT NULL
              AND ARRAY_LENGTH(sd.scenario_ids, 1) > 0
        ),
        ARRAY[]::types.q_get_training_simulations_v4_item[]
    ) AS items,
    COALESCE(
        (SELECT ARRAY_AGG(DISTINCT sgd.standard_group_id ORDER BY sgd.standard_group_id)
         FROM standard_group_data sgd),
        ARRAY[]::uuid[]
    ) AS standard_group_ids,
    COALESCE(
        (SELECT ARRAY_AGG(DISTINCT sd.standard_id ORDER BY sd.standard_id)
         FROM standard_data sd),
        ARRAY[]::uuid[]
    ) AS standard_ids;
$$;

