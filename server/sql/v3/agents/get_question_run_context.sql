-- Get all data needed to run question agent with optimized JOIN
-- Parameters: $1=department_id (uuid), $2=policy_ids[] (uuid array), $3=profile_id (uuid, nullable)
-- Returns: agent, model, provider, policies, and profile data
WITH params AS (
    -- Explicitly cast parameters for asyncpg type inference
    SELECT $1::uuid as department_id, $2::uuid[] as policy_ids, $3::uuid as profile_id
),
default_guest AS (
    SELECT id::text as guest_profile_id
    FROM profiles 
    WHERE role = 'guest' AND default_profile = true 
    LIMIT 1
),
best_agent AS (
    SELECT a.id as agent_id
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    CROSS JOIN params p
    WHERE a.role = 'question'
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
    -- Get rate limit for the profile (use provided profile_id or default guest)
    SELECT 
        prl.requests_per_day as req_per_day
    FROM profiles prof
    LEFT JOIN profile_request_limits prl ON prl.profile_id = prof.id AND prl.active = true
    WHERE prof.id = COALESCE(
        (SELECT profile_id FROM params WHERE profile_id IS NOT NULL),
        (SELECT id FROM profiles WHERE role = 'guest' AND default_profile = true LIMIT 1)
    )
),
runs_today AS (
    -- Count model runs for the profile since start of day
    SELECT 
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM runs mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id
    WHERE mrp.profile_id = COALESCE(
        (SELECT profile_id FROM params WHERE profile_id IS NOT NULL),
        (SELECT id FROM profiles WHERE role = 'guest' AND default_profile = true LIMIT 1)
    )
      AND mrp.active = true
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
)
SELECT 
    -- Agent data
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
    
    -- Custom model (if any) - indicated by presence of base_url in model_endpoints
    CASE WHEN me.base_url IS NOT NULL AND me.base_url != '' THEN m.name ELSE NULL END as custom_model,
    
    -- Provider data (provider enum is now on models table, no separate providers table)
    NULL::text as provider_id,
    m.provider::text as provider_name,
    
    -- Policies data (aggregated as JSON array)
    -- Include file_path and mime_type so format_policy_info can read actual PDF content
    COALESCE(
        (SELECT json_agg(
            json_build_object(
                'id', pol.id::text,
                'name', pol.name,
                'content', pol.description,
                'file_path', pol.file_path,
                'mime_type', pol.mime_type
            )
            ORDER BY array_position(p.policy_ids, pol.id)
        )
        FROM policies pol
        WHERE pol.id = ANY(p.policy_ids)
        ),
        '[]'::json
    ) as policies,
    
    -- Profile data (use provided profile_id or default guest)
    COALESCE(
        (SELECT profile_id::text FROM params WHERE profile_id IS NOT NULL),
        dg.guest_profile_id
    ) as profile_id,
    
    -- Default guest profile
    dg.guest_profile_id as default_guest_profile_id,
    
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
LEFT JOIN model_endpoints me ON me.model_id = m.id AND me.active = true
LEFT JOIN model_keys mk ON mk.model_id = m.id AND mk.active = true
LEFT JOIN keys k ON k.id = mk.key_id AND k.active = true
CROSS JOIN default_guest dg
CROSS JOIN profile_rate_limit prl
CROSS JOIN runs_today rt

