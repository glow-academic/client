-- Get all data needed to run simulation agent with optimized JOIN
-- Parameters: $1=chat_id (uuid)
-- Returns: chat, attempt, scenario, persona, model, provider, simulation settings, profile, and documents data
WITH scenario_dept AS (
    SELECT 
        s.id as scenario_id,
        (SELECT sd.department_id FROM scenario_departments sd 
         WHERE sd.scenario_id = s.id AND sd.active = true LIMIT 1) as department_id
    FROM simulation_chats sc
    JOIN attempt_chats ac ON ac.chat_id = sc.id
    INNER JOIN simulation_attempts sa ON sa.id = ac.attempt_id
    INNER JOIN scenarios s ON s.id = sc.scenario_id
    WHERE sc.id = $1::uuid
),
profile_rate_limit AS (
    -- Get rate limit for the profile (via attempt_profiles)
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
    sc.id::text as chat_id,
    sc.title as chat_title,
    sc.trace_id,
    
    -- Attempt data
    sa.id::text as attempt_id,
    sa.simulation_id::text,
    
    -- Scenario data
    s.id::text as scenario_id,
    (SELECT sd.department_id::text FROM scenario_departments sd 
     WHERE sd.scenario_id = s.id AND sd.active = true LIMIT 1) as department_id,
    sps.problem_statement,
    
    -- Persona data (via scenario_personas junction)
    p.id::text as persona_id,
    p.name as persona_name,
    COALESCE(
        COALESCE(pr_prompt_dept.system_prompt, pr_prompt_default.system_prompt),
        ''
    ) as system_prompt,
    p.temperature,
    p.reasoning,
    
    -- Model data
    m.id::text as model_id,
    m.name as model_name,
    m.custom_model,
    
    -- Provider data
    pr.id::text as provider_id,
    pr.name as provider_name,
    COALESCE(pe.base_url, '') as base_url,
    pr.api_key,
    
    -- Scenario settings (flags moved from simulations to scenarios)
    s.image_input_enabled,
    s.copy_paste_allowed,
    s.output_guardrail_enabled,
    
    -- Profile data (via attempt_profiles junction)
    ap.profile_id::text as profile_id,
    
    -- Rate limit data
    prl.req_per_day,
    COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
    rt.earliest_run_created_at,
    
    -- Documents data (aggregated as JSON array with full document info)
    COALESCE(
        json_agg(
            json_build_object(
                'id', d.id::text,
                'name', d.name,
                'file_path', d.file_path,
                'mime_type', d.mime_type
            )
            ORDER BY d.id
        ) FILTER (WHERE d.id IS NOT NULL AND sd.active = true),
        '[]'::json
    ) as documents

FROM simulation_chats sc
JOIN attempt_chats ac ON ac.chat_id = sc.id
INNER JOIN simulation_attempts sa ON sa.id = ac.attempt_id
INNER JOIN scenarios s ON s.id = sc.scenario_id
LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
INNER JOIN simulations sim ON sim.id = sa.simulation_id
LEFT JOIN scenario_personas sp ON sp.scenario_id = s.id AND sp.active = true
LEFT JOIN personas p ON p.id = sp.persona_id
-- Try department-specific persona prompt first, fall back to default prompt
LEFT JOIN scenario_dept sc_dept ON sc_dept.scenario_id = s.id
LEFT JOIN persona_department_prompts pdp_prompt ON pdp_prompt.persona_id = p.id 
    AND pdp_prompt.department_id = sc_dept.department_id
    AND pdp_prompt.active = true
LEFT JOIN prompts pr_prompt_dept ON pr_prompt_dept.id = pdp_prompt.prompt_id
LEFT JOIN persona_prompts pp ON pp.persona_id = p.id AND pp.active = true
LEFT JOIN prompts pr_prompt_default ON pr_prompt_default.id = pp.prompt_id
LEFT JOIN models m ON m.id = p.model_id
LEFT JOIN providers pr ON pr.id = m.provider_id
LEFT JOIN provider_endpoints pe ON pe.provider_id = pr.id AND pe.active = true
LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = true
LEFT JOIN scenario_documents sd ON sd.scenario_id = s.id
LEFT JOIN documents d ON d.id = sd.document_id
CROSS JOIN profile_rate_limit prl
CROSS JOIN runs_today rt
WHERE sc.id = $1::uuid
GROUP BY sc.id, sc.title, sc.trace_id,
         sa.id, sa.simulation_id,
         s.id, sps.problem_statement,
         p.id, p.name, pr_prompt_dept.system_prompt, pr_prompt_default.system_prompt, p.temperature, p.reasoning,
         m.id, m.name, m.custom_model,
         pr.id, pr.name, pr.api_key, pe.base_url,
         s.image_input_enabled, s.copy_paste_allowed, s.output_guardrail_enabled,
         ap.profile_id,
         prl.req_per_day, rt.runs_today_count, rt.earliest_run_created_at

