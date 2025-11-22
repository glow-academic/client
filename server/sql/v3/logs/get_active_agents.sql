-- Get first active simulation persona and assistant agent with provider credentials
-- Returns both simulation (from personas) and assistant (from agents) in a single query
-- Uses UNION to combine results with a 'type' field to distinguish them
SELECT 
    p.id, 
    p.name, 
    COALESCE(pr_prompt.system_prompt, '') as system_prompt, 
    p.temperature,
    m.provider::text as provider_name, 
    k.key as api_key,
    COALESCE(me.base_url, '') as base_url, 
    m.name as model_name,
    p.reasoning,
    'simulation' as agent_type
FROM personas p
JOIN models m ON p.model_id = m.id
LEFT JOIN model_endpoints me ON me.model_id = m.id AND me.active = true
LEFT JOIN model_keys mk ON mk.model_id = m.id AND mk.active = true
LEFT JOIN keys k ON k.id = mk.key_id AND k.active = true AND k.type = 'api'
LEFT JOIN persona_prompts pp ON pp.persona_id = p.id AND pp.active = true
LEFT JOIN prompts pr_prompt ON pr_prompt.id = pp.prompt_id
WHERE p.active = true
LIMIT 1

UNION ALL

SELECT 
    a.id, 
    a.name, 
    COALESCE(pr_prompt.system_prompt, '') as system_prompt, 
    a.temperature,
    m.provider::text as provider_name, 
    k2.key as api_key,
    COALESCE(me2.base_url, '') as base_url, 
    m.name as model_name,
    a.reasoning,
    'assistant' as agent_type
FROM agents a
JOIN models m ON a.model_id = m.id
LEFT JOIN model_endpoints me2 ON me2.model_id = m.id AND me2.active = true
LEFT JOIN model_keys mk2 ON mk2.model_id = m.id AND mk2.active = true
LEFT JOIN keys k2 ON k2.id = mk2.key_id AND k2.active = true AND k2.type = 'api'
LEFT JOIN agent_prompts ap ON ap.agent_id = a.id AND ap.active = true
LEFT JOIN prompts pr_prompt ON pr_prompt.id = ap.prompt_id
WHERE a.role = 'assistant' AND a.active = true
LIMIT 1

