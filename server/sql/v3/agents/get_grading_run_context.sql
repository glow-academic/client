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
        s.rubric_id,
        (SELECT sd.department_id::text FROM simulation_departments sd 
         WHERE sd.simulation_id = s.id AND sd.active = true LIMIT 1) as department_id,
        stl.time_limit_seconds as time_limit
    FROM simulations s
    LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
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
)
SELECT 
    -- Chat data
    ci.id::text as chat_id,
    ci.scenario_id::text,
    ci.attempt_id::text,
    ci.title,
    ci.trace_id,
    ci.created_at,
    ci.completed,
    
    -- Scenario data
    sps.problem_statement,
    
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
    m.custom_model,
    
    -- Provider data
    pr.id::text as provider_id,
    pr.name as provider_name,
    COALESCE(pe.base_url, '') as base_url,
    pr.api_key,
    
    -- Profile data (via attempt_profiles junction)
    ap.profile_id::text

FROM chat_info ci
CROSS JOIN attempt_info ai
CROSS JOIN simulation_info si
CROSS JOIN best_agent ba
INNER JOIN scenarios sc ON sc.id = ci.scenario_id
LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = sc.id AND sps.active = true
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
INNER JOIN providers pr ON pr.id = m.provider_id
LEFT JOIN provider_endpoints pe ON pe.provider_id = pr.id AND pe.active = true
LEFT JOIN attempt_profiles ap ON ap.attempt_id = ai.id AND ap.active = true
GROUP BY ci.id, ci.scenario_id, ci.attempt_id, ci.title, ci.trace_id, ci.created_at, ci.completed,
         sps.problem_statement,
         ai.id, ai.simulation_id, ai.total_chats,
         si.id, si.rubric_id, si.department_id, si.time_limit,
         r.id, r.name, r.description, r.points, r.pass_points,
         a.id, a.name, pr_prompt.system_prompt, a.temperature, a.reasoning,
         m.id, m.name, m.custom_model,
         pr.id, pr.name, pr.api_key, pe.base_url,
         ap.profile_id

