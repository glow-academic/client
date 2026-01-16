-- Get all data needed to run grading agent AND create run in single atomic transaction
-- Converted to PostgreSQL function pattern
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_grading_run_context_and_create_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_grading_run_context_and_create_run_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_grading_run_context_and_create_run_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types for output (standard groups and standards as composite types)
CREATE TYPE types.q_get_grading_run_context_and_create_run_v4_standard_group AS (
    id text,
    name text,
    short_name text,
    description text,
    points integer,
    pass_points integer,
    rubric_id text
);

CREATE TYPE types.q_get_grading_run_context_and_create_run_v4_standard AS (
    id text,
    name text,
    description text,
    points integer,
    standard_group_id text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION socket_get_grading_run_context_and_create_run_v4(
    chat_id uuid,
    department_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    -- Chat data
    chat_id text,
    scenario_id text,
    chat_attempt_id text,
    title text,
    trace_id text,
    chat_created_at timestamptz,
    completed boolean,
    problem_statement text,
    -- Attempt data
    attempt_id text,
    simulation_id text,
    total_chats integer,
    -- Simulation data
    simulation_id_out text,
    rubric_id_out text,
    simulation_rubric_id text,
    department_id_out text,
    time_limit integer,
    rubric_grade_agent_id text,
    grade_agent_id text,
    audio_agent_id text,
    -- Rubric data
    rubric_name text,
    rubric_description text,
    rubric_points integer,
    rubric_pass_points integer,
    -- Standard groups and standards (as composite type arrays)
    standard_groups types.q_get_grading_run_context_and_create_run_v4_standard_group[],
    standards types.q_get_grading_run_context_and_create_run_v4_standard[],
    -- Agent data
    agent_id text,
    agent_name text,
    system_prompt text,
    temperature float,
    reasoning text,
    -- Model data
    model_id text,
    model_name text,
    provider text,
    base_url text,
    api_key text,
    -- Profile data
    profile_id_out text,
    -- Rate limit data
    req_per_day integer,
    runs_today_count bigint,
    earliest_run_created_at timestamptz,
    -- Run ID (created in same transaction)
    run_id text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        chat_id AS chat_id,
        department_id AS department_id,
        profile_id AS profile_id
),
chat_info AS (
    SELECT 
        sc.id,
        sc.scenario_id,
        ac.attempt_id,
        sc.title,
        g.trace_id,
        sc.created_at,
        sc.completed
    FROM chats sc
    JOIN attempt_chats ac ON ac.chat_id = sc.id
    LEFT JOIN chat_groups cg ON cg.chat_id = sc.id
    LEFT JOIN groups g ON g.id = cg.group_id
    WHERE sc.id = (SELECT chat_id FROM params)
),
attempt_info AS (
    SELECT 
        sa.id,
        sa.simulation_id,
        (SELECT COUNT(*) FROM attempt_chats WHERE attempt_id = sa.id) as total_chats
    FROM simulation_attempts sa
    WHERE sa.id = (SELECT attempt_id FROM chat_info)
),
scenario_rubric_grade_agent AS (
    -- Get rubric_grade_agent_id for this scenario
    SELECT 
        rga.id as rubric_grade_agent_id,
        rga.rubric_id,
        rga.grade_agent_id,
        rgav.audio_agent_id
    FROM chat_info ci
    CROSS JOIN attempt_info ai
    JOIN simulation_scenarios_scenario_rubric_grade_agents sssrga ON sssrga.simulation_id = ai.simulation_id AND sssrga.scenario_id = ci.scenario_id
    JOIN scenario_rubric_grade_agents_resource srga ON srga.id = sssrga.scenario_rubric_grade_agent_id
    JOIN rubric_grade_agents rga ON rga.id = srga.grade_agent_id
    LEFT JOIN rubric_grade_agents_audio rgav ON rgav.rubric_grade_agent_id = rga.id
    LIMIT 1
),
simulation_info AS (
    SELECT 
        s.id,
        srga.rubric_id,
        (SELECT sd.department_id::text FROM simulation_departments sd 
         WHERE sd.simulation_id = s.id AND sd.active = true LIMIT 1) as department_id,
        srga.rubric_grade_agent_id::text as rubric_grade_agent_id,
        srga.grade_agent_id::text as grade_agent_id,
        srga.audio_agent_id::text as audio_agent_id,
        COALESCE(
            (SELECT SUM(stl.time_limit_seconds)
             FROM scenario_time_limits stl
             JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
             WHERE stl.simulation_id = s.id 
               AND stl.active = true 
               AND EXISTS (SELECT 1 FROM simulation_scenario_flags ssf JOIN flags_resource f ON ssf.scenario_flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id 
                   AND ssf.scenario_id = ss.scenario_id 
                   AND f.name = 'active' 
                   AND ssf.value = true)),
            0
        ) as time_limit
    FROM simulation_artifact s
    CROSS JOIN scenario_rubric_grade_agent srga
    WHERE s.id = (SELECT simulation_id FROM attempt_info)
),
best_agent AS (
    -- Use grade_agent_id from rubric_grade_agents (for text grading)
    SELECT a.id as agent_id
    FROM simulation_info si
    JOIN agents_resource a ON a.id = si.grade_agent_id::uuid
    WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' AND af.value = true) AND si.grade_agent_id IS NOT NULL
    LIMIT 1
),
profile_rate_limit AS (
    -- Get rate limit for the profile
    SELECT 
        rl.requests_per_day as req_per_day
    FROM params p
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.profile_id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limit_id = rl.id
),
runs_today AS (
    -- Count model runs for this profile since start of day
    SELECT 
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM runs mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id
    WHERE mrp.profile_id = (SELECT profile_id FROM params)
      AND mrp.active = true
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
profile_primary_department AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments pd ON pd.profile_id = p.profile_id
    WHERE pd.is_primary = TRUE 
      AND pd.active = true
    LIMIT 1
),
default_settings AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = true)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
dept_specific_settings AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    WHERE ppd.department_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = true) 
      AND sd.active = true
    LIMIT 1
),
settings_with_keys AS (
    SELECT DISTINCT spk.settings_id
    FROM setting_provider_keys spk
    JOIN keys_resource kr ON kr.id = spk.key_id
    WHERE spk.active = true AND EXISTS (SELECT 1 FROM key_flags kf JOIN flags_resource f ON kf.flag_id = f.id WHERE kf.key_id = kr.id AND f.name = 'active' AND kf.value = TRUE) = true
),
dept_specific_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE ppd.department_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = true) AND sd.active = true
    LIMIT 1
),
default_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = true)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
active_settings AS (
    SELECT 
        COALESCE(
            (SELECT settings_id FROM dept_specific_settings_with_keys),
            (SELECT settings_id FROM default_settings_with_keys),
            (SELECT settings_id FROM settings_with_keys LIMIT 1),
            (SELECT settings_id FROM dept_specific_settings),
            (SELECT settings_id FROM default_settings),
            (SELECT s.id FROM setting_artifact s WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = true) LIMIT 1)
        ) as settings_id
),
standard_groups_data AS (
    -- Get standard groups data for aggregation
    SELECT DISTINCT
        sg.id,
        sg.name,
        sg.short_name,
        sg.description,
        sg.points,
        sg.pass_points,
        rsg.rubric_id
    FROM chat_info ci
    CROSS JOIN attempt_info ai
    CROSS JOIN simulation_info si
    INNER JOIN rubrics_resource r ON r.id = si.rubric_id
    LEFT JOIN rubric_standard_groups rsg ON rsg.rubric_id = r.id AND rsg.active = true
    LEFT JOIN standard_groups_resource sg ON sg.id = rsg.standard_group_id
    WHERE sg.id IS NOT NULL
),
standards_data AS (
    -- Get standards data for aggregation
    SELECT DISTINCT
        std.id,
        std.name,
        std.description,
        std.points,
        std.standard_group_id
    FROM chat_info ci
    CROSS JOIN attempt_info ai
    CROSS JOIN simulation_info si
    INNER JOIN rubrics_resource r ON r.id = si.rubric_id
    LEFT JOIN rubric_standard_groups rsg ON rsg.rubric_id = r.id AND rsg.active = true
    LEFT JOIN standard_groups_resource sg ON sg.id = rsg.standard_group_id
    LEFT JOIN standards std ON std.standard_group_id = sg.id
    WHERE std.id IS NOT NULL
),
context_data AS (
    -- Get all context data (agent, model, provider, rubric, standard groups, standards, etc.)
    SELECT 
        -- Chat data
        ci.id::text as chat_id,
        ci.scenario_id::text,
        ci.attempt_id::text as chat_attempt_id,
        ci.title,
        ci.trace_id,
        ci.created_at as chat_created_at,
        ci.completed,
        
        -- Scenario data
        ps.problem_statement,
        
        -- Attempt data
        ai.id::text as attempt_id,
        ai.simulation_id::text as attempt_simulation_id,
        ai.total_chats,
        
        -- Simulation data
        si.id::text as simulation_id,
        si.rubric_id::text as simulation_rubric_id,
        si.department_id::text,
        si.time_limit,
        si.rubric_grade_agent_id::text as rubric_grade_agent_id,
        si.grade_agent_id::text as grade_agent_id,
        si.audio_agent_id::text as audio_agent_id,
        
        -- Rubric data
        r.id::text as rubric_id,
        (SELECT n.name FROM rubric_names rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1) as rubric_name,
        (SELECT d.description FROM rubric_descriptions rd JOIN descriptions_resource d ON rd.description_id = d.id WHERE rd.rubric_id = r.id LIMIT 1) as rubric_description,
        (SELECT p.value FROM rubric_points rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = r.id AND rp.type = 'total' LIMIT 1) as rubric_points,
        (SELECT p.value FROM rubric_points rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = r.id AND rp.type = 'pass' LIMIT 1) as rubric_pass_points,
        
        -- Agent data (via department_agents junction for 'grade' role)
        a.id::text as agent_id,
        (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1) as agent_name,
        COALESCE(pr_prompt.system_prompt, '') as system_prompt,
        COALESCE(tl.temperature, 0.0) as temperature,
        rl.reasoning_level as reasoning,
        
        -- Model data
        m.id::text as model_id,
        (SELECT v.value FROM model_values mv JOIN values_resource v ON mv.value_id = v.id WHERE mv.model_id = m.id LIMIT 1) as model_name,
        COALESCE(n_prov.name, '') as provider,
        COALESCE(e.base_url, '') as base_url,
        kr.key as api_key,
        
        -- Profile data
        p.profile_id::text as profile_id,
        
        -- Rate limit data
        prl.req_per_day,
        COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
        rt.earliest_run_created_at

    FROM chat_info ci
    CROSS JOIN attempt_info ai
    CROSS JOIN simulation_info si
    CROSS JOIN best_agent ba
    CROSS JOIN params p
    INNER JOIN scenarios_resource sc ON sc.id = ci.scenario_id
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = sc.id AND sps.active = true
    LEFT JOIN problem_statements_resource ps ON ps.id = sps.problem_statement_id
    INNER JOIN rubrics_resource r ON r.id = si.rubric_id
    INNER JOIN agents_resource a ON a.id = ba.agent_id
    -- Try department-specific prompt first, fall back to default prompt
    LEFT JOIN agent_department_prompts adp_prompt ON adp_prompt.agent_id = a.id AND adp_prompt.department_id = p.department_id AND adp_prompt.active = true
    LEFT JOIN prompts_resource pr_prompt_dept ON pr_prompt_dept.id = adp_prompt.prompt_id
    LEFT JOIN agent_prompts ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
    LEFT JOIN prompts_resource pr_prompt_default ON pr_prompt_default.id = ap_default.prompt_id
    -- Use department-specific prompt if available, otherwise use default
    LEFT JOIN prompts_resource pr_prompt ON pr_prompt.id = COALESCE(pr_prompt_dept.id, pr_prompt_default.id)
    INNER JOIN agent_models am ON am.agent_id = a.id
    INNER JOIN models_resource m ON m.id = am.model_id
    -- Join temperature from junction table
    LEFT JOIN agent_temperature_levels atl ON atl.agent_id = a.id AND atl.active = true
    LEFT JOIN model_temperature_levels mtl ON mtl.temperature_level_id = atl.temperature_level_id AND mtl.model_id = m.id 
LEFT JOIN temperature_levels_resource tl ON tl.id = mtl.temperature_level_id AND tl.active = true
    -- Join reasoning from junction table
    LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = a.id AND arl.active = true
    LEFT JOIN model_reasoning_levels mrl ON mrl.reasoning_level_id = arl.reasoning_level_id AND mrl.model_id = m.id 
LEFT JOIN reasoning_levels_resource rl ON rl.id = mrl.reasoning_level_id AND rl.active = true
    LEFT JOIN model_endpoints me_j ON me_j.model_id = m.id
    LEFT JOIN endpoints_resource e ON e.id = me_j.endpoint_id AND e.active = true
    -- Get keys via settings system: provider -> active settings -> setting_provider_keys
    LEFT JOIN model_providers mp ON mp.model_id = m.id
    LEFT JOIN providers_resource p_prov ON p_prov.id = mp.providers_id
    LEFT JOIN provider_artifact pr_prov ON pr_prov.id = p_prov.provider_id
    LEFT JOIN provider_names pn_prov ON pn_prov.provider_id = pr_prov.id
    LEFT JOIN names_resource n_prov ON n_prov.id = pn_prov.name_id
    CROSS JOIN active_settings act_s
    LEFT JOIN setting_provider_keys spk ON spk.providers_id = p_prov.id 
        AND spk.settings_id = act_s.settings_id 
        AND spk.active = true
    LEFT JOIN keys_resource kr ON kr.id = spk.key_id AND EXISTS (SELECT 1 FROM key_flags kf JOIN flags_resource f ON kf.flag_id = f.id WHERE kf.key_id = kr.id AND f.name = 'active' AND kf.value = TRUE) = true
    CROSS JOIN profile_rate_limit prl
    CROSS JOIN runs_today rt
    -- Validate rate limit: raises exception if exceeded (function returns TRUE if valid)
    WHERE validate_rate_limit(prl.req_per_day, COALESCE(rt.runs_today_count, 0)) = TRUE
),
standard_groups_aggregated AS (
    -- Aggregate standard groups as composite type array
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (sgd.id::text, sgd.name, sgd.short_name, COALESCE(sgd.description, ''), sgd.points, sgd.pass_points, sgd.rubric_id::text)::types.q_get_grading_run_context_and_create_run_v4_standard_group
                ORDER BY sgd.name
            ),
            ARRAY[]::types.q_get_grading_run_context_and_create_run_v4_standard_group[]
        ) as standard_groups
    FROM standard_groups_data sgd
),
standards_aggregated AS (
    -- Aggregate standards as composite type array
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (std.id::text, std.name, COALESCE(std.description, ''), std.points, std.standard_group_id::text)::types.q_get_grading_run_context_and_create_run_v4_standard
                ORDER BY std.name
            ),
            ARRAY[]::types.q_get_grading_run_context_and_create_run_v4_standard[]
        ) as standards
    FROM standards_data std
),
create_run AS (
    -- Create run record with all junction records (atomic with context query)
    INSERT INTO runs (input_tokens, output_tokens, key_id, agent_id)
    SELECT 0, 0, NULL, cd.agent_id::uuid
    FROM context_data cd
    RETURNING id
),
link_model AS (
    -- Link model to run
    INSERT INTO run_models (run_id, model_id, active)
    SELECT cr.id, cd.model_id::uuid, true
    FROM create_run cr
    CROSS JOIN context_data cd
    RETURNING run_id
),
link_profile AS (
    -- Link profile to run
    INSERT INTO run_profiles (run_id, profile_id, active)
    SELECT lm.run_id, cd.profile_id::uuid, true
    FROM link_model lm
    CROSS JOIN context_data cd
    WHERE cd.profile_id IS NOT NULL
    RETURNING run_id
)
SELECT 
    -- Context data
    cd.chat_id,
    cd.scenario_id,
    cd.chat_attempt_id,
    cd.title,
    cd.trace_id,
    cd.chat_created_at,
    cd.completed,
    cd.problem_statement,
    cd.attempt_id,
    cd.simulation_id,
    cd.total_chats,
    cd.simulation_id as simulation_id_out,
    cd.rubric_id as rubric_id_out,
    cd.simulation_rubric_id,
    cd.department_id as department_id_out,
    cd.time_limit,
    cd.rubric_grade_agent_id,
    cd.grade_agent_id,
    cd.audio_agent_id,
    cd.rubric_name,
    cd.rubric_description,
    cd.rubric_points,
    cd.rubric_pass_points,
    -- Standard groups and standards as composite type arrays
    sga.standard_groups,
    sta.standards,
    cd.agent_id,
    cd.agent_name,
    cd.system_prompt,
    cd.temperature,
    cd.reasoning,
    cd.model_id,
    cd.model_name,
    cd.provider,
    cd.base_url,
    cd.api_key,
    cd.profile_id as profile_id_out,
    cd.req_per_day,
    cd.runs_today_count,
    cd.earliest_run_created_at,
    -- Run ID (created in same transaction)
    cr.id::text as run_id
FROM context_data cd
CROSS JOIN create_run cr
CROSS JOIN standard_groups_aggregated sga
CROSS JOIN standards_aggregated sta
$$;