-- Get all data needed to run grading agent with optimized JOIN
-- Parameters: $1=chat_id (uuid), $2=department_id (uuid)
-- Returns: chat, attempt, scenario, simulation, rubric, standard groups, standards, agent, model, provider, and profile data
WITH chat_info AS (
    SELECT 
        sc.id,
        sc.scenario_id,
        ac.attempt_id,
        sc.title,
        sc.trace_id,
        sc.created_at,
        sc.completed
    FROM simulation_chats sc
    JOIN attempt_chats ac ON ac.chat_id = sc.id
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
    FROM model_runs mr
    JOIN model_run_profiles mrp ON mrp.model_run_id = mr.id
    WHERE mrp.profile_id = (SELECT ap.profile_id FROM attempt_profiles ap 
                            JOIN attempt_chats ac ON ac.attempt_id = ap.attempt_id 
                            WHERE ac.chat_id = $1::uuid AND ap.active = true LIMIT 1)
      AND mrp.active = true
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
)
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
    ai.simulation_id::text,
    ai.total_chats,
    
    -- Simulation data
    si.id::text as simulation_id,
    si.rubric_id::text,
    si.department_id::text,
    si.time_limit,
    
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
                'rubric_id', sg.rubric_id::text
            )
            ORDER BY jsonb_build_object(
                'id', sg.id::text,
                'name', sg.name,
                'short_name', sg.short_name,
                'description', sg.description,
                'points', sg.points,
                'pass_points', sg.pass_points,
                'rubric_id', sg.rubric_id::text
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
    a.temperature,
    a.reasoning,
    
    -- Model data
    m.id::text as model_id,
    m.name as model_name,
    m.provider::text as provider,
    COALESCE(me.base_url, '') as base_url,
    k.key as api_key,
    
    -- Profile data (via attempt_profiles junction)
    ap.profile_id::text,
    
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
LEFT JOIN standard_groups sg ON sg.rubric_id = r.id
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
LEFT JOIN model_endpoints me ON me.model_id = m.id AND me.active = true
LEFT JOIN model_keys mk ON mk.model_id = m.id AND mk.active = true
LEFT JOIN keys k ON k.id = mk.key_id AND k.active = true AND k.type = 'api'
LEFT JOIN attempt_profiles ap ON ap.attempt_id = ai.id AND ap.active = true
CROSS JOIN profile_rate_limit prl
CROSS JOIN runs_today rt
GROUP BY ci.id, ci.scenario_id, ci.attempt_id, ci.title, ci.trace_id, ci.created_at, ci.completed,
         ps.problem_statement,
         ai.id, ai.simulation_id, ai.total_chats,
         si.id, si.rubric_id, si.department_id, si.time_limit,
         r.id, r.name, r.description, r.points, r.pass_points,
         a.id, a.name, pr_prompt.system_prompt, a.temperature, a.reasoning,
         m.id, m.name, m.custom_model,
         pr.id, pr.name, k.key, pe.base_url,
         ap.profile_id,
         prl.req_per_day, rt.runs_today_count, rt.earliest_run_created_at

