-- Get all data needed to run grading agent AND create run in single atomic transaction
-- Parameters: $1=chat_id (uuid), $2=department_id (uuid)
-- Returns: agent, model, provider, rubric, standard groups, standards, AND run_id
-- Validates rate limit and creates run atomically - if run creation fails, entire transaction rolls back
-- Based on get_grading_run_context.sql but adds run creation
WITH chat_info AS (
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
    WHERE sc.id = $1::uuid
),
attempt_info AS (
    SELECT 
        sa.id,
        sa.simulation_id,
        (SELECT COUNT(*) FROM attempt_chats WHERE attempt_id = sa.id) as total_chats
    FROM simulation_attempts sa
    WHERE sa.id = (SELECT attempt_id FROM chat_info)
),
simulation_info AS (
    SELECT 
        s.id,
        (SELECT ss.rubric_id FROM simulation_scenarios ss WHERE ss.simulation_id = s.id AND ss.active = true ORDER BY ss.position LIMIT 1) as rubric_id,
        (SELECT sd.department_id::text FROM simulation_departments sd 
         WHERE sd.simulation_id = s.id AND sd.active = true LIMIT 1) as department_id,
        s.grade_voice_agent_id::text as grade_voice_agent_id,
        COALESCE(
            (SELECT SUM(stl.time_limit_seconds)
             FROM scenario_time_limits stl
             JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
             WHERE stl.simulation_id = s.id AND stl.active = true AND ss.active = true),
            0
        ) as time_limit
    FROM simulations s
    WHERE s.id = (SELECT simulation_id FROM attempt_info)
),
best_agent AS (
    SELECT a.id as agent_id
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    WHERE a.role = 'grade'
    AND a.active = true
    AND (
        -- Include if agent is linked to the specified department
        ad.department_id = $2::uuid
        -- OR agent has no department links (cross-department)
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
    )
    ORDER BY 
        -- Prioritize department-specific agents over cross-department agents
        CASE WHEN ad.department_id = $2::uuid THEN 0 ELSE 1 END
    LIMIT 1
),
profile_rate_limit AS (
    -- Get rate limit for the profile (calculated after we have profile_id from attempt_profiles)
    SELECT 
        prl.requests_per_day as req_per_day
    FROM profiles p
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
    WHERE p.id = (SELECT ap.profile_id FROM attempt_profiles ap 
                  JOIN attempt_chats ac ON ac.attempt_id = ap.attempt_id 
                  WHERE ac.chat_id = $1::uuid AND ap.active = true LIMIT 1)
),
runs_today AS (
    -- Count model runs for this profile since start of day
    SELECT 
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM runs mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id
    WHERE mrp.profile_id = (SELECT ap.profile_id FROM attempt_profiles ap 
                            JOIN attempt_chats ac ON ac.attempt_id = ap.attempt_id 
                            WHERE ac.chat_id = $1::uuid AND ap.active = true LIMIT 1)
      AND mrp.active = true
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
profile_from_attempt AS (
    -- Get profile_id from attempt_profiles for settings resolution
    SELECT ap.profile_id
    FROM attempt_profiles ap 
    JOIN attempt_chats ac ON ac.attempt_id = ap.attempt_id 
    WHERE ac.chat_id = $1::uuid AND ap.active = true
    LIMIT 1
),
-- Get active settings for profile (for key lookup via setting_provider_keys)
default_settings AS (
    SELECT s.id as settings_id
    FROM settings s
    WHERE s.active = true
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
profile_primary_department AS (
    SELECT pd.department_id
    FROM profile_from_attempt pfa
    JOIN profile_departments pd ON pd.profile_id = pfa.profile_id
    WHERE pd.is_primary = TRUE 
      AND pd.active = true
    LIMIT 1
),
dept_specific_settings AS (
    SELECT s.id as settings_id
    FROM settings s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    WHERE ppd.department_id IS NOT NULL
      AND s.active = true 
      AND sd.active = true
    LIMIT 1
),
settings_with_keys AS (
    SELECT DISTINCT spk.settings_id
    FROM setting_provider_keys spk
    JOIN keys k ON k.id = spk.key_id
    WHERE spk.active = true AND k.active = true
),
dept_specific_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM settings s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE ppd.department_id IS NOT NULL
      AND s.active = true AND sd.active = true
    LIMIT 1
),
default_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM settings s
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE s.active = true
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
            (SELECT id FROM settings WHERE active = true LIMIT 1)
        ) as settings_id
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
        si.grade_voice_agent_id,
        
        -- Rubric data
        r.id::text as rubric_id,
        r.name as rubric_name,
        r.description as rubric_description,
        r.points as rubric_points,
        r.pass_points as rubric_pass_points,
        
        -- Standard groups (aggregated as JSON array)
        COALESCE(
            json_agg(
                DISTINCT jsonb_build_object(
                    'id', sg.id::text,
                    'name', sg.name,
                    'short_name', sg.short_name,
                    'description', sg.description,
                    'points', sg.points,
                    'pass_points', sg.pass_points,
                    'rubric_id', rsg.rubric_id::text
                )
                ORDER BY jsonb_build_object(
                    'id', sg.id::text,
                    'name', sg.name,
                    'short_name', sg.short_name,
                    'description', sg.description,
                    'points', sg.points,
                    'pass_points', sg.pass_points,
                    'rubric_id', rsg.rubric_id::text
                )
            ) FILTER (WHERE sg.id IS NOT NULL),
            '[]'::json
        ) as standard_groups,
        
        -- Standards (aggregated as JSON array)
        COALESCE(
            json_agg(
                DISTINCT jsonb_build_object(
                    'id', std.id::text,
                    'name', std.name,
                    'description', std.description,
                    'points', std.points,
                    'standard_group_id', std.standard_group_id::text
                )
                ORDER BY jsonb_build_object(
                    'id', std.id::text,
                    'name', std.name,
                    'description', std.description,
                    'points', std.points,
                    'standard_group_id', std.standard_group_id::text
                )
            ) FILTER (WHERE std.id IS NOT NULL),
            '[]'::json
        ) as standards,
        
        -- Agent data (via department_agents junction for 'grade' role)
        a.id::text as agent_id,
        a.name as agent_name,
        COALESCE(pr_prompt.system_prompt, '') as system_prompt,
        COALESCE(mtl.temperature, 0.0) as temperature,
        mrl.reasoning_level as reasoning,
        
        -- Model data
        m.id::text as model_id,
        m.value as model_name,
        COALESCE(p.value::text, '') as provider,
        COALESCE(me.base_url, '') as base_url,
        k.key as api_key,
        
        -- Profile data (via attempt_profiles junction)
        ap.profile_id::text as profile_id,
        
        -- Rate limit data
        prl.req_per_day,
        COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
        rt.earliest_run_created_at

    FROM chat_info ci
    CROSS JOIN attempt_info ai
    CROSS JOIN simulation_info si
    CROSS JOIN best_agent ba
    INNER JOIN scenarios sc ON sc.id = ci.scenario_id
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = sc.id AND sps.active = true
    LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
    INNER JOIN rubrics r ON r.id = si.rubric_id
    LEFT JOIN rubric_standard_groups rsg ON rsg.rubric_id = r.id AND rsg.active = true
    LEFT JOIN standard_groups sg ON sg.id = rsg.standard_group_id
    LEFT JOIN standards std ON std.standard_group_id = sg.id
    INNER JOIN agents a ON a.id = ba.agent_id
    -- Try department-specific prompt first, fall back to default prompt
    LEFT JOIN agent_department_prompts adp_prompt ON adp_prompt.agent_id = a.id AND adp_prompt.department_id = $2::uuid AND adp_prompt.active = true
    LEFT JOIN prompts pr_prompt_dept ON pr_prompt_dept.id = adp_prompt.prompt_id
    LEFT JOIN agent_prompts ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
    LEFT JOIN prompts pr_prompt_default ON pr_prompt_default.id = ap_default.prompt_id
    -- Use department-specific prompt if available, otherwise use default
    LEFT JOIN prompts pr_prompt ON pr_prompt.id = COALESCE(pr_prompt_dept.id, pr_prompt_default.id)
    INNER JOIN models m ON m.id = a.model_id
    -- Join temperature from junction table
    LEFT JOIN agent_temperature_levels atl ON atl.agent_id = a.id AND atl.active = true
    LEFT JOIN model_temperature_levels mtl ON mtl.id = atl.model_temperature_level_id AND mtl.active = true AND mtl.model_id = m.id
    -- Join reasoning from junction table
    -- IMPORTANT: Only join reasoning levels that belong to the agent's model (m.id = mrl.model_id)
    LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = a.id AND arl.active = true
    LEFT JOIN model_reasoning_levels mrl ON mrl.id = arl.model_reasoning_level_id AND mrl.active = true AND mrl.model_id = m.id
    LEFT JOIN model_endpoints me ON me.model_id = m.id AND me.active = true
    -- Get keys via settings system: provider -> active settings -> setting_provider_keys
    LEFT JOIN providers p ON p.id = m.provider_id
    CROSS JOIN active_settings act_s
    LEFT JOIN setting_provider_keys spk ON spk.provider_id = p.id 
        AND spk.settings_id = act_s.settings_id 
        AND spk.active = true
    LEFT JOIN keys k ON k.id = spk.key_id AND k.active = true
    LEFT JOIN attempt_profiles ap ON ap.attempt_id = ai.id AND ap.active = true
    CROSS JOIN profile_rate_limit prl
    CROSS JOIN runs_today rt
    WHERE validate_rate_limit(prl.req_per_day, COALESCE(rt.runs_today_count, 0)) = TRUE
    GROUP BY ci.id, ci.scenario_id, ci.attempt_id, ci.title, ci.trace_id, ci.created_at, ci.completed,
             ps.problem_statement,
             ai.id, ai.simulation_id, ai.total_chats,
             si.id, si.rubric_id, si.department_id, si.time_limit, si.grade_voice_agent_id,
             r.id, r.name, r.description, r.points, r.pass_points,
             a.id, a.name, pr_prompt.system_prompt, COALESCE(mtl.temperature, 0.0), mrl.reasoning_level,
             m.id, m.value, p.value, me.base_url, k.key, act_s.settings_id,
             ap.profile_id,
             prl.req_per_day, rt.runs_today_count, rt.earliest_run_created_at
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
    cd.department_id,
    cd.time_limit,
    cd.grade_voice_agent_id,
    cd.rubric_name,
    cd.rubric_description,
    cd.rubric_points,
    cd.rubric_pass_points,
    cd.standard_groups,
    cd.standards,
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
    cd.profile_id,
    cd.req_per_day,
    cd.runs_today_count,
    cd.earliest_run_created_at,
    -- Run ID (created in same transaction)
    cr.id::text as run_id
FROM context_data cd
CROSS JOIN create_run cr

