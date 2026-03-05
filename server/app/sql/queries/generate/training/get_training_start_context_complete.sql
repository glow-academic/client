-- Get context data for training simulation generation validation.
-- Derives simulation, scenario, and agent from training_entry + department scope.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_get_training_start_context_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_training_start_context_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION socket_get_training_start_context_v4(
    p_profile_id uuid,
    p_chat_entry_id uuid,
    p_department_id uuid,
    p_draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    agent_id uuid,
    agent_exists boolean,
    agent_name text,
    agent_is_active boolean,
    model_id uuid,
    model_name text,
    provider_id uuid,
    provider_name text,
    has_api_key boolean,
    requests_per_day integer,
    runs_today bigint,
    simulation_exists boolean,
    simulation_is_active boolean,
    simulation_id uuid,
    simulation_name text,
    profile_has_access boolean,
    scenario_id uuid,
    has_problem_statement boolean,
    has_persona boolean,
    problem_statement text,
    objectives jsonb,
    persona jsonb,
    video_ids uuid[],
    image_ids uuid[],
    valid_entry_types text[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        p_profile_id AS profile_id,
        p_chat_entry_id AS chat_entry_id,
        p_department_id AS department_id,
        p_draft_id AS draft_id
),
scope AS (
    SELECT
        tb.id AS chat_entry_id,
        scj_conn.scenarios_id,
        COALESCE(hsc.simulations_id, psc.simulations_id) AS simulations_id,
        COALESCE(hcc.cohorts_id, pcc.cohorts_id) AS cohorts_id,
        COALESCE(he.active, pe.active, false) AS training_active,
        sa.id AS simulation_artifact_id,
        s.name AS simulation_name,
        s.active AS simulation_resource_active,
        sc.id AS scenario_artifact_id
    FROM params p
    JOIN chat_entry tb
      ON tb.id = p.chat_entry_id
     AND tb.active = true
    LEFT JOIN home_chat_entry hte ON hte.chat_id = tb.id
    LEFT JOIN home_entry he ON he.id = hte.home_id
    LEFT JOIN practice_chat_entry pte ON pte.chat_id = tb.id
    LEFT JOIN practice_entry pe ON pe.id = pte.practice_id
    LEFT JOIN home_simulations_connection hsc ON hsc.home_id = he.id AND hsc.active = true
    LEFT JOIN practice_simulations_connection psc ON psc.practice_id = pe.id AND psc.active = true
    LEFT JOIN home_cohorts_connection hcc ON hcc.home_id = he.id AND hcc.active = true
    LEFT JOIN practice_cohorts_connection pcc ON pcc.practice_id = pe.id AND pcc.active = true
    LEFT JOIN chat_scenarios_connection scj_conn
      ON scj_conn.chat_id = tb.id
     AND scj_conn.active = true
    LEFT JOIN simulation_simulations_junction ssj
      ON ssj.simulations_id = COALESCE(hsc.simulations_id, psc.simulations_id)
     AND ssj.active = true
    LEFT JOIN simulation_artifact sa
      ON sa.id = ssj.simulation_id
    LEFT JOIN simulations_resource s
      ON s.id = COALESCE(hsc.simulations_id, psc.simulations_id)
    LEFT JOIN scenario_scenarios_junction scj
      ON scj.scenario_id = scj_conn.scenarios_id
     AND scj.active = true
    LEFT JOIN scenario_artifact sc
      ON sc.id = scj.scenario_id
    LIMIT 1
),
selected_agent AS (
    SELECT a.id AS agent_id
    FROM params p
    JOIN agent_artifact a ON TRUE
    WHERE EXISTS (
        SELECT 1
        FROM agent_flags_junction af
        JOIN flags_resource f ON f.id = af.flags_id
        WHERE af.agent_id = a.id
          AND f.name = 'agent_active'
          AND f.value = true
    )
      AND (
        NOT EXISTS (
            SELECT 1
            FROM agent_departments_junction ad
            WHERE ad.agent_id = a.id
              AND ad.active = true
        )
        OR EXISTS (
            SELECT 1
            FROM agent_departments_junction ad
            WHERE ad.agent_id = a.id
              AND ad.departments_id = p.department_id
              AND ad.active = true
        )
      )
    ORDER BY a.id
    LIMIT 1
),
agent_data AS (
    SELECT
        sa.agent_id,
        TRUE AS agent_exists,
        (SELECT n.name
         FROM agent_names_junction an
         JOIN names_resource n ON n.id = an.names_id
         WHERE an.agent_id = sa.agent_id
         LIMIT 1) AS agent_name,
        TRUE AS agent_is_active
    FROM selected_agent sa
),
model_data AS (
    SELECT
        mr.id AS model_id,
        mr.value AS model_name,
        mr.provider_id
    FROM selected_agent sa
    JOIN agent_agents_junction aaj
      ON aaj.agent_id = sa.agent_id
     AND aaj.active = true
    JOIN agents_resource ar
      ON ar.id = aaj.agents_id
    JOIN models_resource mr
      ON mr.id = ar.model_id
    LIMIT 1
),
provider_data AS (
    SELECT
        pr.id AS providers_resource_id,
        pr.key AS provider_key,
        (SELECT n.name
         FROM provider_providers_junction ppj
         JOIN provider_names_junction pn ON pn.provider_id = ppj.provider_id
         JOIN names_resource n ON n.id = pn.names_id
         WHERE ppj.providers_id = pr.id
           AND ppj.active = true
         LIMIT 1) AS provider_name
    FROM model_data md
    JOIN providers_resource pr ON pr.id = md.provider_id
    LIMIT 1
),
api_key_check AS (
    SELECT (pd.provider_key IS NOT NULL AND pd.provider_key != '') AS has_api_key
    FROM provider_data pd
),
rate_limit_data AS (
    SELECT rl.requests_per_day
    FROM params p
    JOIN profile_artifact prof ON prof.id = p.profile_id
    LEFT JOIN profile_request_limits_junction prl
      ON prl.profile_id = prof.id
     AND prl.active = true
    LEFT JOIN request_limits_resource rl
      ON rl.id = prl.request_limits_id
),
runs_today_data AS (
    SELECT COUNT(*)::bigint AS runs_today
    FROM params p
    JOIN profiles_runs_connection prj ON prj.profile_id = p.profile_id
    JOIN runs_entry vr ON vr.id = prj.run_id
    WHERE vr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
simulation_data AS (
    SELECT
        s.simulation_artifact_id AS simulation_id,
        (s.simulation_artifact_id IS NOT NULL) AS simulation_exists,
        s.simulation_name,
        COALESCE(s.training_active AND s.simulation_resource_active, false) AS simulation_is_active
    FROM scope s
),
access_data AS (
    SELECT EXISTS (
        SELECT 1
        FROM params p
        JOIN scope s ON TRUE
        JOIN profile_profiles_junction ppj
          ON ppj.profile_id = p.profile_id
         AND ppj.active = true
        JOIN cohort_profiles_junction cpj
          ON cpj.profile_id = ppj.profile_id
         AND cpj.active = true
        JOIN cohort_cohorts_junction ccj
          ON ccj.cohort_id = cpj.cohort_id
         AND ccj.active = true
        WHERE ccj.cohorts_id = s.cohorts_id
    ) AS has_access
),
scenario_content AS (
    SELECT
        s.scenario_artifact_id AS scenario_id,
        EXISTS (
            SELECT 1
            FROM scenario_problem_statements_junction spj
            JOIN problem_statements_resource psr ON psr.id = spj.problem_statements_id
            WHERE spj.scenario_id = s.scenario_artifact_id
              AND spj.active = true
        ) AS has_problem_statement,
        CASE
            WHEN p.draft_id IS NOT NULL THEN EXISTS (
                SELECT 1
                FROM chat_drafts_personas_connection pdc
                WHERE pdc.draft_id = p.draft_id
            )
            ELSE EXISTS (
                SELECT 1
                FROM scenario_personas_junction spj
                WHERE spj.scenario_id = s.scenario_artifact_id
                  AND spj.active = true
            )
        END AS has_persona,
        (SELECT psr.problem_statement
         FROM scenario_problem_statements_junction spj
         JOIN problem_statements_resource psr ON psr.id = spj.problem_statements_id
         WHERE spj.scenario_id = s.scenario_artifact_id
           AND spj.active = true
         LIMIT 1) AS problem_statement,
        (SELECT jsonb_agg(jsonb_build_object('id', o.id, 'objective', o.objective))
         FROM scenario_objectives_junction soj
         JOIN objectives_resource o ON o.id = soj.objectives_id
         WHERE soj.scenario_id = s.scenario_artifact_id
           AND soj.active = true) AS objectives,
        (
            SELECT jsonb_build_object(
                'id', pa.id,
                'name', (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON n.id = pn.names_id WHERE pn.persona_id = pa.id LIMIT 1),
                'description', (SELECT d.description FROM persona_descriptions_junction pd JOIN descriptions_resource d ON d.id = pd.descriptions_id WHERE pd.persona_id = pa.id LIMIT 1)
            )
            FROM persona_artifact pa
            WHERE pa.id = COALESCE(
                (
                    SELECT pdc.persona_id
                    FROM chat_drafts_personas_connection pdc
                    WHERE p.draft_id IS NOT NULL
                      AND pdc.draft_id = p.draft_id
                    LIMIT 1
                ),
                (
                    SELECT spj.personas_id
                    FROM scenario_personas_junction spj
                    WHERE spj.scenario_id = s.scenario_artifact_id
                      AND spj.active = true
                    LIMIT 1
                )
            )
            LIMIT 1
        ) AS persona,
        (SELECT ARRAY_AGG(svj.video_id)
         FROM scenario_videos_junction svj
         WHERE svj.scenario_id = s.scenario_artifact_id
           AND svj.active = true) AS video_ids,
        (SELECT ARRAY_AGG(sij.image_id)
         FROM scenario_images_junction sij
         WHERE sij.scenario_id = s.scenario_artifact_id
           AND sij.active = true) AS image_ids
    FROM scope s
    CROSS JOIN params p
)
SELECT
    ad.agent_id,
    COALESCE(ad.agent_exists, FALSE) AS agent_exists,
    ad.agent_name,
    COALESCE(ad.agent_is_active, FALSE) AS agent_is_active,
    md.model_id,
    md.model_name,
    pd.providers_resource_id AS provider_id,
    pd.provider_name,
    COALESCE(akc.has_api_key, FALSE) AS has_api_key,
    rld.requests_per_day,
    COALESCE(rtd.runs_today, 0) AS runs_today,
    COALESCE(sd.simulation_exists, FALSE) AS simulation_exists,
    COALESCE(sd.simulation_is_active, FALSE) AS simulation_is_active,
    sd.simulation_id,
    sd.simulation_name,
    COALESCE(acd.has_access, FALSE) AS profile_has_access,
    sc.scenario_id,
    COALESCE(sc.has_problem_statement, FALSE) AS has_problem_statement,
    COALESCE(sc.has_persona, FALSE) AS has_persona,
    sc.problem_statement,
    sc.objectives,
    sc.persona,
    sc.video_ids,
    sc.image_ids,
    ARRAY['contents', 'hints', 'grades', 'feedbacks']::text[] AS valid_entry_types
FROM params p
LEFT JOIN agent_data ad ON TRUE
LEFT JOIN model_data md ON TRUE
LEFT JOIN provider_data pd ON TRUE
LEFT JOIN api_key_check akc ON TRUE
LEFT JOIN rate_limit_data rld ON TRUE
LEFT JOIN runs_today_data rtd ON TRUE
LEFT JOIN simulation_data sd ON TRUE
LEFT JOIN access_data acd ON TRUE
LEFT JOIN scenario_content sc ON TRUE;
$$;
