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
)
SELECT 
    -- Agent data (via department_agents junction for 'classify' role)
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
INNER JOIN models m ON m.id = a.model_id
INNER JOIN providers pr ON pr.id = m.provider_id
LEFT JOIN provider_endpoints pe ON pe.provider_id = pr.id AND pe.active = true
LEFT JOIN documents d ON d.id = ANY($1::uuid[])
GROUP BY a.id, a.name, pr_prompt.system_prompt, a.temperature, a.reasoning,
         m.id, m.name, m.custom_model,
         pr.id, pr.name, pr.api_key, pe.base_url

