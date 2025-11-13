-- Get all data needed to run scenario agent with optimized JOIN
-- Parameters: $1=department_id (uuid), $2=persona_id (uuid, nullable), $3=document_ids[] (uuid array), $4=parameter_item_ids[] (uuid array)
-- Returns: agent, model, provider, persona, documents, parameter items, and default guest profile data
WITH default_guest AS (
    SELECT id::text as guest_profile_id
    FROM profiles 
    WHERE role = 'guest' AND default_profile = true 
    LIMIT 1
),
best_agent AS (
    SELECT a.id as agent_id
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    WHERE a.role = 'scenario'
    AND a.active = true
    AND (
        -- Include if agent is linked to the specified department
        ad.department_id = $1::uuid
        -- OR agent has no department links (cross-department)
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
    )
    ORDER BY 
        -- Prioritize department-specific agents over cross-department agents
        CASE WHEN ad.department_id = $1::uuid THEN 0 ELSE 1 END
    LIMIT 1
)
SELECT 
    -- Agent data (via department_agents junction for 'scenario' role)
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
    
    -- Persona data (nullable)
    p.id::text as persona_id,
    p.name as persona_name,
    p.description as persona_description,
    
    -- Documents data (aggregated as JSON array)
    COALESCE(
        (SELECT json_agg(
            json_build_object(
                'id', d.id::text,
                'name', d.name,
                'file_path', d.file_path,
                'mime_type', d.mime_type
            )
            ORDER BY array_position($3::uuid[], d.id)
        )
        FROM documents d
        WHERE d.id = ANY($3::uuid[])
        ),
        '[]'::json
    ) as documents,
    
    -- Parameter items data (aggregated as JSON array with parameter info)
    COALESCE(
        (SELECT json_agg(
            json_build_object(
                'item_name', pi.name,
                'item_description', pi.description,
                'param_name', pa.name,
                'param_description', pa.description
            )
            ORDER BY array_position($4::uuid[], pi.id)
        )
        FROM parameter_items pi
        JOIN parameters pa ON pi.parameter_id = pa.id
        WHERE pi.id = ANY($4::uuid[])
        ),
        '[]'::json
    ) as parameter_items,
    
    -- Default guest profile
    dg.guest_profile_id

FROM best_agent ba
INNER JOIN agents a ON a.id = ba.agent_id
-- Try department-specific prompt first, fall back to default prompt
LEFT JOIN agent_department_prompts adp_prompt ON adp_prompt.agent_id = a.id AND adp_prompt.department_id = $1::uuid AND adp_prompt.active = true
LEFT JOIN prompts pr_prompt_dept ON pr_prompt_dept.id = adp_prompt.prompt_id
LEFT JOIN agent_prompts ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
LEFT JOIN prompts pr_prompt_default ON pr_prompt_default.id = ap_default.prompt_id
-- Use department-specific prompt if available, otherwise use default
LEFT JOIN prompts pr_prompt ON pr_prompt.id = COALESCE(pr_prompt_dept.id, pr_prompt_default.id)
INNER JOIN models m ON m.id = a.model_id
INNER JOIN providers pr ON pr.id = m.provider_id
LEFT JOIN provider_endpoints pe ON pe.provider_id = pr.id AND pe.active = true
LEFT JOIN personas p ON p.id = $2::uuid
CROSS JOIN default_guest dg

