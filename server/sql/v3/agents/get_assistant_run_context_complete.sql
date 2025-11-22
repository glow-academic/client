-- Get all data needed to run assistant agent with messages and tool_calls aggregated
-- Parameters: $1=chat_id (uuid), $2=department_id (uuid)
-- Returns: chat, profile, agent, model, provider data, plus messages and tool_calls as JSONB arrays
WITH best_agent AS (
    SELECT a.id as agent_id
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    WHERE a.role = 'assistant'
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
messages_agg AS (
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', id::text,
                    'created_at', created_at,
                    'updated_at', updated_at,
                    'chat_id', chat_id::text,
                    'role', role,
                    'content', content,
                    'completed', completed
                )
                ORDER BY created_at ASC
            ),
            '[]'::jsonb
        ) as messages
    FROM assistant_messages
    WHERE chat_id = $1::uuid
),
tool_calls_agg AS (
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', id::text,
                    'created_at', created_at,
                    'updated_at', updated_at,
                    'chat_id', chat_id::text,
                    'tool_name', tool_name,
                    'tool_type', tool_type,
                    'tool_arguments', tool_arguments,
                    'tool_result', tool_result,
                    'completed', completed
                )
                ORDER BY created_at ASC
            ),
            '[]'::jsonb
        ) as tool_calls
    FROM assistant_tool_calls
    WHERE chat_id = $1::uuid
),
profile_rate_limit AS (
    -- Get rate limit for the profile
    SELECT 
        prl.requests_per_day as req_per_day
    FROM profiles p
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
    WHERE p.id = (SELECT profile_id FROM assistant_chats WHERE id = $1::uuid)
),
runs_today AS (
    -- Count model runs for this profile since start of day
    SELECT 
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM model_runs mr
    JOIN model_run_profiles mrp ON mrp.model_run_id = mr.id
    WHERE mrp.profile_id = (SELECT profile_id FROM assistant_chats WHERE id = $1::uuid)
      AND mrp.active = true
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
)
SELECT 
    -- Chat data
    ac.id::text as chat_id,
    ac.title,
    ac.trace_id,
    ac.profile_id::text,
    
    -- Profile data
    p.role as user_role,
    p.first_name as user_first_name,
    p.last_name as user_last_name,
    
    -- Agent data (via department_agents junction)
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
    
    -- Aggregated messages and tool_calls
    COALESCE(ma.messages, '[]'::jsonb) as messages,
    COALESCE(tca.tool_calls, '[]'::jsonb) as tool_calls,
    
    -- Rate limit data
    prl.req_per_day,
    COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
    rt.earliest_run_created_at

FROM assistant_chats ac
INNER JOIN profiles p ON p.id = ac.profile_id
CROSS JOIN best_agent ba
INNER JOIN agents a ON a.id = ba.agent_id
INNER JOIN models m ON m.id = a.model_id
LEFT JOIN model_endpoints me ON me.model_id = m.id AND me.active = true
LEFT JOIN model_keys mk ON mk.model_id = m.id AND mk.active = true
LEFT JOIN keys k ON k.id = mk.key_id AND k.active = true AND k.type = 'api'
-- Try department-specific prompt first, fall back to default prompt
LEFT JOIN agent_department_prompts adp_prompt ON adp_prompt.agent_id = a.id AND adp_prompt.department_id = $2::uuid AND adp_prompt.active = true
LEFT JOIN prompts pr_prompt_dept ON pr_prompt_dept.id = adp_prompt.prompt_id
LEFT JOIN agent_prompts ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
LEFT JOIN prompts pr_prompt_default ON pr_prompt_default.id = ap_default.prompt_id
-- Use department-specific prompt if available, otherwise use default
LEFT JOIN prompts pr_prompt ON pr_prompt.id = COALESCE(pr_prompt_dept.id, pr_prompt_default.id)
CROSS JOIN messages_agg ma
CROSS JOIN tool_calls_agg tca
CROSS JOIN profile_rate_limit prl
CROSS JOIN runs_today rt
WHERE ac.id = $1::uuid

