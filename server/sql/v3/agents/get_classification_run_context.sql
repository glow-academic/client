-- Get all data needed to run classification agent with optimized JOIN
-- Parameters: $1=document_ids[] (uuid array), $2=department_id (uuid)
-- Returns: agent, model, provider, and documents data
WITH best_agent AS (
    SELECT a.id as agent_id
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    WHERE a.role = 'classify'
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
    -- Get rate limit for the default guest profile
    SELECT 
        prl.requests_per_day as req_per_day
    FROM profiles p
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
    WHERE p.id = (SELECT id FROM profiles WHERE role = 'guest' AND default_profile = true LIMIT 1)
),
runs_today AS (
    -- Count model runs for the default guest profile since start of day
    SELECT 
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM runs mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id
    WHERE mrp.profile_id = (SELECT id FROM profiles WHERE role = 'guest' AND default_profile = true LIMIT 1)
      AND mrp.active = true
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
)
SELECT 
    -- Agent data (via department_agents junction for 'classify' role)
    a.id::text as agent_id,
    a.name as agent_name,
    COALESCE(pr_prompt.system_prompt, '') as system_prompt,
    COALESCE(mtl.temperature, 0.0) as temperature,
    mrl.reasoning_level as reasoning,
    
    -- Model data
    m.id::text as model_id,
    m.name as model_name,
    m.provider::text as provider,
    COALESCE(me.base_url, '') as base_url,
    k.key as api_key,
    
    -- Rate limit data (for default guest profile)
    prl.req_per_day,
    COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
    rt.earliest_run_created_at,
    
    -- Documents data (aggregated as JSON array)
    COALESCE(
        json_agg(
            json_build_object(
                'id', d.id::text,
                'name', d.name,
                'type', d.type
            )
            ORDER BY d.name
        ) FILTER (WHERE d.id IS NOT NULL),
        '[]'::json
    ) as documents

FROM best_agent ba
INNER JOIN agents a ON a.id = ba.agent_id
-- Try department-specific prompt first, fall back to default prompt
LEFT JOIN agent_department_prompts adp_prompt ON adp_prompt.agent_id = a.id AND adp_prompt.department_id = $2::uuid AND adp_prompt.active = true
LEFT JOIN prompts pr_prompt_dept ON pr_prompt_dept.id = adp_prompt.prompt_id
LEFT JOIN agent_prompts ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
LEFT JOIN prompts pr_prompt_default ON pr_prompt_default.id = ap_default.prompt_id
-- Use department-specific prompt if available, otherwise use default
LEFT JOIN prompts pr_prompt ON pr_prompt.id = COALESCE(pr_prompt_dept.id, pr_prompt_default.id)
-- Join temperature from junction table
LEFT JOIN agent_temperature_levels atl ON atl.agent_id = a.id AND atl.active = true
LEFT JOIN model_temperature_levels mtl ON mtl.id = atl.model_temperature_level_id AND mtl.active = true
-- Join reasoning from junction table
LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = a.id AND arl.active = true
LEFT JOIN model_reasoning_levels mrl ON mrl.id = arl.model_reasoning_level_id AND mrl.active = true
INNER JOIN models m ON m.id = a.model_id
LEFT JOIN model_endpoints me ON me.model_id = m.id AND me.active = true
LEFT JOIN model_keys mk ON mk.model_id = m.id AND mk.active = true
LEFT JOIN keys k ON k.id = mk.key_id AND k.active = true
LEFT JOIN documents d ON d.id = ANY($1::uuid[])
CROSS JOIN profile_rate_limit prl
CROSS JOIN runs_today rt
GROUP BY a.id, a.name, pr_prompt.system_prompt, COALESCE(mtl.temperature, 0.0), mrl.reasoning_level,
         m.id, m.name, m.provider, me.base_url, k.key,
         prl.req_per_day, rt.runs_today_count, rt.earliest_run_created_at

