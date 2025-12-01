-- Get all data needed to run hint agent with optimized JOIN
-- Parameters: $1=message_id (uuid), $2=chat_id (uuid), $3=department_id (uuid)
-- Returns: message, chat, attempt, scenario, agent (hint role), model, provider, documents, and profile data
WITH target_message AS (
    SELECT id, chat_id, type, content, created_at
    FROM messages
    WHERE id = $1::uuid AND chat_id = $2::uuid
),
chat_info AS (
    SELECT sc.id, ac.attempt_id, sc.scenario_id, sc.trace_id, sc.title
    FROM chats sc
    JOIN attempt_chats ac ON ac.chat_id = sc.id
    JOIN target_message tm ON tm.chat_id = sc.id
),
attempt_info AS (
    SELECT sa.id, sa.simulation_id
    FROM simulation_attempts sa
    JOIN chat_info ci ON ci.attempt_id = sa.id
),
scenario_info AS (
    SELECT s.id, ps.problem_statement
    FROM scenarios s
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
    JOIN chat_info ci ON ci.scenario_id = s.id
),
profile_info AS (
    SELECT ap.profile_id
    FROM attempt_profiles ap
    JOIN attempt_info ai ON ai.id = ap.attempt_id
    WHERE ap.active = true
    LIMIT 1
),
best_agent AS (
    SELECT a.id as agent_id
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    WHERE a.role = 'hint'
    AND a.active = true
    AND (
        -- Include if agent is linked to the specified department
        ad.department_id = $3::uuid
        -- OR agent has no department links (cross-department)
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
    )
    ORDER BY 
        -- Prioritize department-specific agents over cross-department agents
        CASE WHEN ad.department_id = $3::uuid THEN 0 ELSE 1 END
    LIMIT 1
),
profile_rate_limit AS (
    -- Get rate limit for the profile (via attempt_profiles)
    SELECT 
        prl.requests_per_day as req_per_day
    FROM profiles p
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
    WHERE p.id = (SELECT profile_id FROM profile_info)
),
runs_today AS (
    -- Count model runs for this profile since start of day
    SELECT 
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM runs mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id
    WHERE mrp.profile_id = (SELECT profile_id FROM profile_info)
      AND mrp.active = true
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
)
SELECT 
    -- Message data
    tm.id::text as message_id,
    tm.created_at as message_created_at,
    
    -- Chat data
    ci.id::text as chat_id,
    ci.attempt_id::text,
    ci.scenario_id::text,
    ci.trace_id,
    ci.title as chat_title,
    
    -- Attempt data
    ai.id::text as attempt_id,
    ai.simulation_id::text,
    
    -- Scenario data
    si.problem_statement,
    
    -- Agent data (hint role)
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
    
    -- Profile data
    pi.profile_id::text,
    
    -- Rate limit data
    prl.req_per_day,
    COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
    rt.earliest_run_created_at,
    
    -- Documents data (aggregated as JSON array with full document info)
    COALESCE(
        (
            SELECT json_agg(
                json_build_object(
                    'id', d.id::text,
                    'name', d.name,
                    'file_path', d.file_path,
                    'mime_type', d.mime_type
                )
                ORDER BY d.id
            )
            FROM scenario_documents sd
            JOIN documents d ON d.id = sd.document_id
            WHERE sd.scenario_id = si.id AND sd.active = true
        ),
        '[]'::json
    ) as documents

FROM target_message tm
CROSS JOIN chat_info ci
CROSS JOIN attempt_info ai
CROSS JOIN scenario_info si
LEFT JOIN profile_info pi ON true
CROSS JOIN best_agent ba
CROSS JOIN profile_rate_limit prl
CROSS JOIN runs_today rt
INNER JOIN agents a ON a.id = ba.agent_id
-- Try department-specific prompt first, fall back to default prompt
LEFT JOIN agent_department_prompts adp_prompt ON adp_prompt.agent_id = a.id AND adp_prompt.department_id = $3::uuid AND adp_prompt.active = true
LEFT JOIN prompts pr_prompt_dept ON pr_prompt_dept.id = adp_prompt.prompt_id
LEFT JOIN agent_prompts ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
LEFT JOIN prompts pr_prompt_default ON pr_prompt_default.id = ap_default.prompt_id
-- Use department-specific prompt if available, otherwise use default
LEFT JOIN prompts pr_prompt ON pr_prompt.id = COALESCE(pr_prompt_dept.id, pr_prompt_default.id)
INNER JOIN models m ON m.id = a.model_id
LEFT JOIN model_endpoints me ON me.model_id = m.id AND me.active = true
LEFT JOIN model_keys mk ON mk.model_id = m.id AND mk.active = true
LEFT JOIN keys k ON k.id = mk.key_id AND k.active = true

