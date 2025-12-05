-- Get all data needed to run simulation agent with optimized JOIN
-- Parameters: $1=chat_id (uuid)
-- Returns: chat, attempt, scenario, persona, model, provider, simulation settings, profile, and documents data
WITH scenario_dept AS (
    SELECT 
        s.id as scenario_id,
        (SELECT sd.department_id FROM scenario_departments sd 
         WHERE sd.scenario_id = s.id AND sd.active = true LIMIT 1) as department_id
    FROM chats sc
    JOIN attempt_chats ac ON ac.chat_id = sc.id
    INNER JOIN simulation_attempts sa ON sa.id = ac.attempt_id
    INNER JOIN scenarios s ON s.id = sc.scenario_id
    WHERE sc.id = $1::uuid
),
profile_dept AS (
    -- Get first department from profile's accessible departments
    SELECT d.id as department_id
    FROM departments d
    JOIN profile_departments pd ON pd.department_id = d.id
    JOIN attempt_profiles ap ON ap.profile_id = pd.profile_id
    JOIN attempt_chats ac ON ac.attempt_id = ap.attempt_id
    WHERE ac.chat_id = $1::uuid 
      AND ap.active = true 
      AND d.active = true
    LIMIT 1
),
any_active_dept AS (
    -- Get any active department as last resort
    SELECT id as department_id
    FROM departments
    WHERE active = true
    LIMIT 1
),
resolved_dept AS (
    -- Resolve department_id with fallback: scenario -> profile -> any active
    SELECT COALESCE(
        (SELECT department_id FROM scenario_dept),
        (SELECT department_id FROM profile_dept),
        (SELECT department_id FROM any_active_dept)
    ) as department_id
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
    FROM runs mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id
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
    (SELECT department_id::text FROM resolved_dept) as department_id,
    ps.problem_statement,
    
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
    m.provider::text as provider,
    COALESCE(me.base_url, '') as base_url,
    k.key as api_key,
    
    -- Scenario settings (flags moved from scenarios to simulation_scenarios)
    COALESCE(ss.image_input_enabled, false) as image_input_enabled,
    COALESCE(ss.copy_paste_allowed, false) as copy_paste_allowed,
    
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
                'file_path', u.file_path,
                'mime_type', u.mime_type
            )
            ORDER BY d.id
        ) FILTER (WHERE d.id IS NOT NULL AND sd.active = true),
        '[]'::json
    ) as documents

FROM chats sc
JOIN attempt_chats ac ON ac.chat_id = sc.id
INNER JOIN simulation_attempts sa ON sa.id = ac.attempt_id
INNER JOIN scenarios s ON s.id = sc.scenario_id
LEFT JOIN simulation_scenarios ss ON ss.simulation_id = sa.simulation_id AND ss.scenario_id = s.id
LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
INNER JOIN simulations sim ON sim.id = sa.simulation_id
LEFT JOIN scenario_personas sp ON sp.scenario_id = s.id AND sp.active = true
LEFT JOIN personas p ON p.id = sp.persona_id
LEFT JOIN persona_agents pa ON pa.persona_id = p.id AND pa.active = true
LEFT JOIN agents a ON a.id = pa.agent_id
-- Try department-specific agent prompt first, fall back to default prompt
LEFT JOIN agent_department_prompts adp_prompt ON adp_prompt.agent_id = a.id 
    AND adp_prompt.department_id = (SELECT department_id FROM resolved_dept)
    AND adp_prompt.active = true
LEFT JOIN prompts pr_prompt_dept ON pr_prompt_dept.id = adp_prompt.prompt_id
LEFT JOIN agent_prompts ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
LEFT JOIN prompts pr_prompt_default ON pr_prompt_default.id = ap_default.prompt_id
LEFT JOIN models m ON m.id = a.model_id
LEFT JOIN model_endpoints me ON me.model_id = m.id AND me.active = true
LEFT JOIN model_keys mk ON mk.model_id = m.id AND mk.active = true
LEFT JOIN keys k ON k.id = mk.key_id AND k.active = true
LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = true
LEFT JOIN scenario_documents sd ON sd.scenario_id = s.id
LEFT JOIN documents d ON d.id = sd.document_id
LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
LEFT JOIN uploads u ON u.id = du.upload_id
CROSS JOIN profile_rate_limit prl
CROSS JOIN runs_today rt
CROSS JOIN resolved_dept
WHERE sc.id = $1::uuid
GROUP BY sc.id, sc.title, sc.trace_id,
         sa.id, sa.simulation_id,
         s.id, ps.problem_statement,
         p.id, p.name, pr_prompt_dept.system_prompt, pr_prompt_default.system_prompt, p.temperature, p.reasoning,
         m.id, m.name, m.provider,
         k.key, me.base_url,
         ss.image_input_enabled, ss.copy_paste_allowed,
         ap.profile_id,
         prl.req_per_day, rt.runs_today_count, rt.earliest_run_created_at

