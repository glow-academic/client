-- Get context data for training simulation generation validation
-- This SQL fetches RAW DATA only - no business logic
-- Python applies the validation rules in permissions.py
-- Extends home context with scenario content checks

-- 1) Drop function first
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

-- 2) Create the function
CREATE OR REPLACE FUNCTION socket_get_training_start_context_v4(
    p_profile_id uuid,
    p_agent_id uuid,
    p_simulation_id uuid,
    p_scenario_id uuid DEFAULT NULL,
    p_entry_types text[] DEFAULT NULL
)
RETURNS TABLE (
    -- Agent context
    agent_exists boolean,
    agent_name text,
    agent_is_active boolean,

    -- Model context
    model_id uuid,
    model_name text,

    -- Provider context
    provider_id uuid,
    provider_name text,

    -- API key context
    has_api_key boolean,

    -- Rate limit context
    requests_per_day integer,
    runs_today bigint,

    -- Simulation context
    simulation_exists boolean,
    simulation_is_active boolean,
    simulation_id uuid,
    simulation_name text,

    -- Access context
    profile_has_access boolean,

    -- Scenario context
    scenario_id uuid,
    has_problem_statement boolean,
    has_persona boolean,
    problem_statement text,
    objectives jsonb,
    persona jsonb,
    video_ids uuid[],
    image_ids uuid[],

    -- Entry types
    valid_entry_types text[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        p_profile_id AS profile_id,
        p_agent_id AS agent_id,
        p_simulation_id AS simulation_id,
        p_scenario_id AS scenario_id,
        p_entry_types AS entry_types
),
-- Check if agent exists
agent_data AS (
    SELECT
        a.id as agent_id,
        TRUE as agent_exists,
        (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1) as agent_name,
        EXISTS (
            SELECT 1 FROM agent_flags_junction af
            JOIN flags_resource f ON af.flag_id = f.id
            WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true
        ) as agent_is_active
    FROM agent_artifact a
    CROSS JOIN params p
    WHERE a.id = p.agent_id
    LIMIT 1
),
-- Get model via denormalized agents_resource.model_id
model_data AS (
    SELECT mr.id as model_id, mr.value as model_name, mr.provider_id as provider_id
    FROM params p
    JOIN agent_agents_junction aaj ON aaj.agent_id = p.agent_id
    JOIN agents_resource ar ON ar.id = aaj.agents_id
    JOIN models_resource mr ON mr.id = ar.model_id
    LIMIT 1
),
-- Get provider via models_resource.provider_id
provider_data AS (
    SELECT
        pr.id as providers_resource_id,
        pr.key as provider_key,
        (SELECT n.name FROM provider_providers_junction ppj JOIN provider_names_junction pn ON pn.provider_id = ppj.provider_id JOIN names_resource n ON pn.name_id = n.id WHERE ppj.providers_id = pr.id AND ppj.active = true LIMIT 1) as provider_name
    FROM model_data md
    JOIN providers_resource pr ON pr.id = md.provider_id
    LIMIT 1
),
-- Check if provider has API key (on providers_resource.key)
api_key_check AS (
    SELECT (pd.provider_key IS NOT NULL AND pd.provider_key != '') as has_api_key
    FROM provider_data pd
),
-- Get rate limit
rate_limit_data AS (
    SELECT rl.requests_per_day
    FROM params p
    JOIN profile_artifact prof ON prof.id = p.profile_id
    LEFT JOIN profile_request_limits_junction prl ON prl.profile_id = prof.id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limit_id = rl.id
),
-- Count runs today
runs_today_data AS (
    SELECT COUNT(*)::bigint as runs_today
    FROM params p
    JOIN profile_runs_junction prj ON prj.profile_id = p.profile_id
    JOIN view_runs_entry mr ON mr.id = prj.run_id
    WHERE mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
-- Check simulation exists (resolve artifact ID to resource via junction)
simulation_data AS (
    SELECT
        p.simulation_id as simulation_id,
        TRUE as simulation_exists,
        s.name as simulation_name,
        s.active as simulation_is_active
    FROM params p
    JOIN simulation_simulations_junction ssj ON ssj.simulation_id = p.simulation_id AND ssj.active = true
    JOIN simulations_resource s ON s.id = ssj.simulations_id
    LIMIT 1
),
-- Check profile access to simulation via cohort
-- Note: cohorts_resource.simulation_ids contains simulations_resource IDs, so resolve artifact→resource first
access_data AS (
    SELECT EXISTS (
        SELECT 1
        FROM params p
        JOIN simulation_simulations_junction ssj ON ssj.simulation_id = p.simulation_id AND ssj.active = true
        JOIN profile_cohorts_junction pc ON pc.profile_id = p.profile_id AND pc.active = true
        JOIN cohort_cohorts_junction ccj ON ccj.cohort_id = pc.cohort_id AND ccj.active = true
        JOIN cohorts_resource cr ON cr.id = ccj.cohorts_id
        WHERE ssj.simulations_id = ANY(cr.simulation_ids)
    ) as has_access
),
-- Get scenario (use provided or first from simulation)
scenario_data AS (
    SELECT
        COALESCE(p.scenario_id, (
            SELECT sc.id
            FROM simulation_scenarios_junction ss
            JOIN scenario_artifact sc ON sc.id = ss.scenario_id
            WHERE ss.simulation_id = p.simulation_id
              AND ss.active = true
            ORDER BY COALESCE(
                (SELECT spr.value
                 FROM simulation_scenario_positions_junction ssp
                 JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id
                 WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id
                 LIMIT 1),
                999999
            ) ASC
            LIMIT 1
        )) as scenario_id
    FROM params p
),
-- Check scenario content
scenario_content AS (
    SELECT
        sd.scenario_id,
        -- Check for problem statement
        EXISTS (
            SELECT 1 FROM scenario_problem_statements_junction spj
            JOIN problem_statements_resource psr ON psr.id = spj.problem_statement_id
            WHERE spj.scenario_id = sd.scenario_id AND spj.active = true
        ) as has_problem_statement,
        -- Check for persona
        EXISTS (
            SELECT 1 FROM scenario_personas_junction spj
            WHERE spj.scenario_id = sd.scenario_id AND spj.active = true
        ) as has_persona,
        -- Get problem statement text
        (SELECT psr.problem_statement FROM scenario_problem_statements_junction spj
         JOIN problem_statements_resource psr ON psr.id = spj.problem_statement_id
         WHERE spj.scenario_id = sd.scenario_id AND spj.active = true
         LIMIT 1) as problem_statement,
        -- Get objectives as jsonb
        (SELECT jsonb_agg(jsonb_build_object('id', o.id, 'objective', o.objective))
         FROM scenario_objectives_junction soj
         JOIN objectives_resource o ON o.id = soj.objective_id
         WHERE soj.scenario_id = sd.scenario_id AND soj.active = true) as objectives,
        -- Get persona as jsonb
        (SELECT jsonb_build_object(
            'id', pa.id,
            'name', (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = pa.id LIMIT 1),
            'description', (SELECT d.description FROM persona_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = pa.id LIMIT 1)
         )
         FROM scenario_personas_junction spj
         JOIN persona_artifact pa ON pa.id = spj.persona_id
         WHERE spj.scenario_id = sd.scenario_id AND spj.active = true
         LIMIT 1) as persona,
        -- Get video IDs
        (SELECT ARRAY_AGG(svj.video_id)
         FROM scenario_videos_junction svj
         WHERE svj.scenario_id = sd.scenario_id AND svj.active = true) as video_ids,
        -- Get image IDs
        (SELECT ARRAY_AGG(sij.image_id)
         FROM scenario_images_junction sij
         WHERE sij.scenario_id = sd.scenario_id AND sij.active = true) as image_ids
    FROM scenario_data sd
),
-- Get valid entry types
valid_entries AS (
    SELECT ARRAY_AGG(br.entry::text) as valid_types
    FROM params p
    JOIN bindings_resource br ON (p.entry_types IS NULL OR br.entry::text = ANY(p.entry_types))
    WHERE br.active = true 
)
SELECT
    COALESCE(ad.agent_exists, FALSE) as agent_exists,
    ad.agent_name,
    COALESCE(ad.agent_is_active, FALSE) as agent_is_active,
    md.model_id,
    md.model_name,
    pd.providers_resource_id as provider_id,
    pd.provider_name,
    COALESCE(akc.has_api_key, FALSE) as has_api_key,
    rld.requests_per_day,
    COALESCE(rtd.runs_today, 0) as runs_today,
    COALESCE(sd.simulation_exists, FALSE) as simulation_exists,
    COALESCE(sd.simulation_is_active, FALSE) as simulation_is_active,
    sd.simulation_id,
    sd.simulation_name,
    COALESCE(acd.has_access, FALSE) as profile_has_access,
    sc.scenario_id,
    COALESCE(sc.has_problem_statement, FALSE) as has_problem_statement,
    COALESCE(sc.has_persona, FALSE) as has_persona,
    sc.problem_statement,
    sc.objectives,
    sc.persona,
    sc.video_ids,
    sc.image_ids,
    ve.valid_types as valid_entry_types
FROM params p
LEFT JOIN agent_data ad ON TRUE
LEFT JOIN model_data md ON TRUE
LEFT JOIN provider_data pd ON TRUE
LEFT JOIN api_key_check akc ON TRUE
LEFT JOIN rate_limit_data rld ON TRUE
LEFT JOIN runs_today_data rtd ON TRUE
LEFT JOIN simulation_data sd ON TRUE
LEFT JOIN access_data acd ON TRUE
LEFT JOIN scenario_content sc ON TRUE
LEFT JOIN valid_entries ve ON TRUE
$$;
