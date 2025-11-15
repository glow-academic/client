-- Get all data needed to run title agent with optimized JOIN
-- Parameters: $1=chat_id (uuid), $2=department_id (uuid)
-- Returns: agent, model, provider, and chat data
WITH params AS (
    -- Explicitly cast parameters to UUID for asyncpg type inference
    SELECT $1::uuid as chat_id, $2::uuid as department_id
),
best_agent AS (
    SELECT a.id as agent_id
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    CROSS JOIN params p
    WHERE a.role = 'title'
    AND a.active = true
    AND (
        -- Include if agent is linked to the specified department
        ad.department_id = p.department_id
        -- OR agent has no department links (cross-department)
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
    )
    ORDER BY 
        -- Prioritize department-specific agents over cross-department agents
        CASE WHEN ad.department_id = p.department_id THEN 0 ELSE 1 END
    LIMIT 1
),
profile_rate_limit AS (
    -- Get rate limit for the profile (via assistant_chats)
    SELECT 
        prl.requests_per_day as req_per_day
    FROM profiles prof
    LEFT JOIN profile_request_limits prl ON prl.profile_id = prof.id AND prl.active = true
    CROSS JOIN params p
    WHERE prof.id = (SELECT profile_id FROM assistant_chats WHERE id = p.chat_id)
),
runs_today AS (
    -- Count model runs for this profile since start of day
    SELECT 
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM model_runs mr
    JOIN model_run_profiles mrp ON mrp.model_run_id = mr.id
    CROSS JOIN params p
    WHERE mrp.profile_id = (SELECT profile_id FROM assistant_chats WHERE id = p.chat_id)
      AND mrp.active = true
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
)
SELECT 
    -- Agent data (via department_agents junction for 'title' role)
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
    
    -- Chat data
    ac.id::text as chat_id,
    ac.profile_id::text as profile_id,
    ac.title as chat_title,
    ac.trace_id as trace_id,
    
    -- Rate limit data
    prl.req_per_day,
    COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
    rt.earliest_run_created_at

FROM best_agent ba
INNER JOIN agents a ON a.id = ba.agent_id
CROSS JOIN params p
-- Try department-specific prompt first, fall back to default prompt
LEFT JOIN agent_department_prompts adp_prompt ON adp_prompt.agent_id = a.id AND adp_prompt.department_id = p.department_id AND adp_prompt.active = true
LEFT JOIN prompts pr_prompt_dept ON pr_prompt_dept.id = adp_prompt.prompt_id
LEFT JOIN agent_prompts ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
LEFT JOIN prompts pr_prompt_default ON pr_prompt_default.id = ap_default.prompt_id
-- Use department-specific prompt if available, otherwise use default
LEFT JOIN prompts pr_prompt ON pr_prompt.id = COALESCE(pr_prompt_dept.id, pr_prompt_default.id)
INNER JOIN models m ON m.id = a.model_id
INNER JOIN providers pr ON pr.id = m.provider_id
LEFT JOIN provider_endpoints pe ON pe.provider_id = pr.id AND pe.active = true
INNER JOIN assistant_chats ac ON ac.id = p.chat_id
CROSS JOIN profile_rate_limit prl
CROSS JOIN runs_today rt

